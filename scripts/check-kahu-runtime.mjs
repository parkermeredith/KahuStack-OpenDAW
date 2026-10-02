// KBW runtime gate: checks the staged Rust-WASM/catalog/worklet lineage used by the Kahu testbed.

import {readFile} from "node:fs/promises"
import {existsSync} from "node:fs"
import {resolve} from "node:path"
import {fileURLToPath} from "node:url"

const childRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const packageRoot = resolve(childRoot, "packages/app/kahu-testbed")
const runtimeRoot = resolve(packageRoot, "public/kahu-runtime")
const wasmPath = resolve(runtimeRoot, "kahu_dsp_wasm.wasm")
const manifestPath = resolve(runtimeRoot, "library-manifest.json")
const workletPath = resolve(packageRoot, "public/worklets/kahu-worklet.js")

for (const path of [wasmPath, manifestPath, workletPath]) {
    if (!existsSync(path)) {
        throw new Error(`Missing Kahu runtime asset: ${path}. Run npm run build:kahu first.`)
    }
}
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const gain = manifest.modules?.find(module => module.id === "utility.gain")
if (gain === undefined || !Number.isInteger(gain.runtime?.registry_index)) {
    throw new Error("Generated catalog is missing utility.gain registry metadata.")
}
const worklet = await readFile(workletPath, "utf8")
if (!worklet.includes('registerProcessor("kahu-dsp", KahuDspProcessor)')) {
    throw new Error("Generated worklet does not register the generic Kahu DSP processor.")
}
if (/^\s*(?:import|export)\s/m.test(worklet)) {
    throw new Error("Generated Kahu worklet must be a standalone script.")
}
const {instance} = await WebAssembly.instantiate(await readFile(wasmPath), {})
for (const exportName of [
    "kahu_rack_reset_node",
    "kahu_meter_create_profile",
    "kahu_meter_process",
    "kahu_perceptual_spectrum_create",
    "kahu_perceptual_spectrum_erb_power_ptr",
]) {
    if (typeof instance.exports[exportName] !== "function") {
        throw new Error(`Rust-WASM runtime is missing ${exportName}.`)
    }
}
const {size: wasmBytes} = await import("node:fs/promises").then(fs => fs.stat(wasmPath))
console.log(JSON.stringify({moduleCount: manifest.modules.length, utilityGainRegistryIndex: gain.runtime.registry_index, wasmBytes, workletBytes: worklet.length}))
