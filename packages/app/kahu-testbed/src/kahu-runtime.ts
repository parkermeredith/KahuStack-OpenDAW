// KBW-1 host bridge: consumes the parent-owned generated manifest contract and retains Rust-WASM
// AudioWorklet devices. Metadata parsing is delegated to the copied canonical validator.

import {parseLibraryManifest} from "./generated/kahu-manifest-runtime.js"
import type {
    DspModuleManifest,
    DspParameterManifest,
    LibraryManifest,
} from "./generated/kahu-manifest-types.js"

export type KahuParameterManifest = DspParameterManifest
export type KahuModuleManifest = DspModuleManifest
export type KahuLibraryManifest = LibraryManifest

const WASM_URL = "/kahu-runtime/kahu_dsp_wasm.wasm"
const MANIFEST_URL = "/kahu-runtime/library-manifest.json"
let workletModule: Promise<void> | undefined
let assets: Promise<Readonly<{wasmBytes: ArrayBuffer, manifest: KahuLibraryManifest}>> | undefined

const loadWorkletModule = (context: AudioContext): Promise<void> => {
    workletModule ??= context.audioWorklet.addModule("/worklets/kahu-gain-worklet.js")
    return workletModule
}

const loadAssets = (): Promise<Readonly<{wasmBytes: ArrayBuffer, manifest: KahuLibraryManifest}>> => {
    assets ??= Promise.all([fetch(WASM_URL), fetch(MANIFEST_URL)]).then(async ([wasmResponse, manifestResponse]) => {
        if (!wasmResponse.ok || !manifestResponse.ok) {
            throw new Error("Kahu Rust-WASM runtime assets are unavailable; run the parent build staging step.")
        }
        const [wasmBytes, rawManifest] = await Promise.all([
            wasmResponse.arrayBuffer(),
            manifestResponse.json()
        ])
        return {wasmBytes, manifest: parseLibraryManifest(rawManifest)}
    })
    return assets
}

export class KahuGainRuntime {
    private readonly node: AudioWorkletNode
    private readonly latencySamples: number
    private readonly module: KahuModuleManifest
    private readonly parameterIds = new Map<string, number>()
    private readonly parameterValues = new Map<number, number>()
    private ready = false

    private constructor(node: AudioWorkletNode, module: KahuModuleManifest) {
        this.node = node
        this.module = module
        this.latencySamples = module.runtime.latency_samples ?? 0
        for (const parameter of module.parameters) {
            this.parameterIds.set(parameter.key, parameter.id)
            this.parameterValues.set(parameter.id, parameter.default)
        }
    }

    static async catalog(): Promise<KahuLibraryManifest> {
        return (await loadAssets()).manifest
    }

    static async create(
        context: AudioContext,
        channels: number,
        maxFrames: number,
        moduleId = "utility.gain"
    ): Promise<KahuGainRuntime> {
        await loadWorkletModule(context)
        const {wasmBytes, manifest} = await loadAssets()
        const module = manifest.modules.find(candidate => candidate.id === moduleId)
        if (module === undefined) {
            throw new Error(`Generated Kahu manifest does not contain ${moduleId}.`)
        }
        const node = new AudioWorkletNode(context, "kahu-dsp", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [channels]
        })
        const runtime = new KahuGainRuntime(node, module)
        try {
            await runtime.initialize(wasmBytes.slice(0), module.runtime.registry_index, context.sampleRate, channels, maxFrames)
            for (const parameter of module.parameters) {
                runtime.setParameter(parameter.key, parameter.default)
            }
        } catch (error) {
            runtime.dispose()
            throw error
        }
        return runtime
    }

    get output(): AudioWorkletNode {
        return this.node
    }

    get latency(): number {
        return this.latencySamples
    }

    get moduleId(): string {
        return this.module.id
    }

    get name(): string {
        return this.module.name
    }

    get parameters(): ReadonlyArray<KahuParameterManifest> {
        return this.module.parameters
    }

    parameterValue(key: string): number {
        const parameterId = this.parameterIds.get(key)
        return parameterId === undefined ? 0 : this.parameterValues.get(parameterId) ?? 0
    }

    setParameter(key: string, value: number): void {
        const parameterId = this.parameterIds.get(key)
        if (parameterId === undefined) {
            return
        }
        this.parameterValues.set(parameterId, value)
        if (this.ready) {
            this.node.port.postMessage({type: "parameter", parameterId, value})
        }
    }

    setGainDb(value: number): void {
        this.setParameter("gain_db", value)
    }

    setBypassed(bypassed: boolean): void {
        this.node.port.postMessage({type: "bypass", bypassed})
    }

    reset(): void {
        this.node.port.postMessage({type: "reset"})
    }

    connectOutput(output: AudioNode): void {
        this.node.disconnect()
        this.node.connect(output)
    }

    dispose(): void {
        this.node.port.postMessage({type: "destroy"})
        this.node.disconnect()
    }

    private initialize(
        wasmBytes: ArrayBuffer,
        moduleIndex: number,
        sampleRate: number,
        channels: number,
        maxFrames: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent<{type: string, message?: string}>): void => {
                if (event.data.type === "ready") {
                    this.ready = true
                    this.node.port.removeEventListener("message", onMessage)
                    resolve()
                } else if (event.data.type === "error") {
                    this.node.port.removeEventListener("message", onMessage)
                    reject(new Error(event.data.message ?? "Kahu Rust-WASM initialization failed."))
                }
            }
            this.node.port.addEventListener("message", onMessage)
            this.node.port.start()
            this.node.port.postMessage({
                type: "init",
                wasmBytes,
                moduleIndex,
                sampleRate,
                channels,
                maxFrames
            }, [wasmBytes])
        })
    }
}
