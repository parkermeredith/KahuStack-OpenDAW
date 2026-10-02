// KBW-8 benchmark: compares the retained per-device reference topology with the consolidated
// Rust-WASM rack at bounded block size. Node timing is a source-level comparison, not browser
// AudioWorklet deadline evidence; owner browser qualification remains a separate gate.

import {readFile, stat} from "node:fs/promises"
import {resolve} from "node:path"
import {performance} from "node:perf_hooks"

const root = resolve(import.meta.dirname, "..")
const runtimeRoot = resolve(root, "packages/app/kahu-testbed/public/kahu-runtime")
const wasmPath = resolve(runtimeRoot, "kahu_dsp_wasm.wasm")
const manifestPath = resolve(runtimeRoot, "library-manifest.json")
const wasmBytes = await readFile(wasmPath)
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const gain = manifest.modules.find(module => module.id === "utility.gain")
if (gain === undefined) throw new Error("utility.gain is missing from the staged canonical manifest")

const lengths = [1, 2, 4, 8, 16]
const channels = 2
const frames = 128
const warmupBlocks = 200
const sampleGroups = 30
const blocksPerGroup = 100
const samples = channels * frames
const copyBytesPerDeviceBlock = samples * Float32Array.BYTES_PER_ELEMENT * 2

const percentile = (values, fraction) => {
    const sorted = [...values].sort((left, right) => left - right)
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]
}

const instantiate = async () => (await WebAssembly.instantiate(wasmBytes, {})).instance.exports

const measure = async (kind, length) => {
    const wasm = await instantiate()
    const started = performance.now()
    const handles = []
    let rackHandle = 0
    if (kind === "reference") {
        for (let index = 0; index < length; index += 1) {
            const handle = wasm.kahu_create(gain.runtime.registry_index, 48_000, channels, frames)
            if (handle === 0) throw new Error(`reference create failed at ${index}`)
            handles.push(handle)
        }
    } else {
        rackHandle = wasm.kahu_rack_create(48_000, channels, frames)
        if (rackHandle === 0) throw new Error("rack create failed")
        for (let index = 0; index < length; index += 1) {
            if (wasm.kahu_rack_add(rackHandle, gain.runtime.registry_index) === 0) throw new Error(`rack add failed at ${index}`)
        }
    }
    const initializationMs = performance.now() - started
    const handle = kind === "reference" ? handles[0] : rackHandle
    const inputPointer = kind === "reference" ? wasm.kahu_input_ptr(handle) : wasm.kahu_rack_input_ptr(handle)
    const input = new Float32Array(wasm.memory.buffer, inputPointer, samples)
    input.fill(0.125)
    const process = kind === "reference" ? wasm.kahu_process : wasm.kahu_rack_process
    for (let block = 0; block < warmupBlocks; block += 1) {
        for (const referenceHandle of handles) {
            if (kind === "reference" && process(referenceHandle, frames) !== 0) throw new Error("reference process failed")
        }
        if (kind === "consolidated" && process(rackHandle, frames) !== 0) throw new Error("rack process failed")
    }
    const groupMs = []
    for (let group = 0; group < sampleGroups; group += 1) {
        const groupStart = performance.now()
        for (let block = 0; block < blocksPerGroup; block += 1) {
            for (const referenceHandle of handles) {
                if (kind === "reference" && process(referenceHandle, frames) !== 0) throw new Error("reference process failed")
            }
            if (kind === "consolidated" && process(rackHandle, frames) !== 0) throw new Error("rack process failed")
        }
        groupMs.push((performance.now() - groupStart) / blocksPerGroup)
    }
    const mutationStart = performance.now()
    if (kind === "reference") {
        for (const referenceHandle of handles) wasm.kahu_destroy(referenceHandle)
        const replacement = wasm.kahu_create(gain.runtime.registry_index, 48_000, channels, frames)
        if (replacement !== 0) wasm.kahu_destroy(replacement)
    } else {
        const added = wasm.kahu_rack_add(rackHandle, gain.runtime.registry_index)
        wasm.kahu_rack_set_bypassed(rackHandle, added, 1)
        wasm.kahu_rack_move(rackHandle, added, -1)
        wasm.kahu_rack_remove(rackHandle, added)
        wasm.kahu_rack_destroy(rackHandle)
    }
    const mutationMs = performance.now() - mutationStart
    const wasmMemoryBytes = wasm.memory.buffer.byteLength
    return {
        topology: kind,
        chainLength: length,
        audioWorkletNodeCount: kind === "reference" ? length : 1,
        wasmInstanceCount: kind === "reference" ? length : 1,
        moduleNodeCount: length,
        jsWasmCopyBytesPerBlock: kind === "reference" ? copyBytesPerDeviceBlock * length : copyBytesPerDeviceBlock,
        initializationMs: Number(initializationMs.toFixed(4)),
        processMsPerBlockP50: Number(percentile(groupMs, 0.5).toFixed(6)),
        processMsPerBlockP95: Number(percentile(groupMs, 0.95).toFixed(6)),
        processMsPerBlockMax: Number(Math.max(...groupMs).toFixed(6)),
        mutationMs: Number(mutationMs.toFixed(4)),
        wasmMemoryBytes,
        blockFrames: frames,
        sampleRate: 48_000,
    }
}

const rows = []
for (const length of lengths) {
    rows.push(await measure("reference", length))
    rows.push(await measure("consolidated", length))
}
const result = {
    schemaVersion: 1,
    benchmark: "KBW-8 Kahu rack scaling",
    environment: "node-wasm-reference",
    note: "Timing excludes browser AudioWorklet scheduling and is not owner runtime qualification.",
    wasmBytes: (await stat(wasmPath)).size,
    rows,
}
console.log(JSON.stringify(result, null, 2))
