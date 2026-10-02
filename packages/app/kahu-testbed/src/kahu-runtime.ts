// KBW-1/7 host bridge: consumes the parent-owned generated manifest contract and exposes both the
// reference per-device runtime and the consolidated Rust-WASM rack.
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
    workletModule ??= context.audioWorklet.addModule("/worklets/kahu-worklet.js")
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

export class ReferenceDeviceRuntime {
    private readonly node: AudioWorkletNode
    private readonly latencySamples: number
    private readonly module: KahuModuleManifest
    private readonly parameterIds = new Map<string, number>()
    private readonly parameterValues = new Map<number, number>()
    private errorHandler: ((message: string) => void) | undefined
    private readonly errorListener = (event: MessageEvent<{type?: string, requestId?: number, message?: string}>): void => {
        if (event.data.type === "error" && event.data.requestId === undefined) {
            this.errorHandler?.(event.data.message ?? "Rust-WASM processing failed.")
        }
    }
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
        moduleId: string
    ): Promise<ReferenceDeviceRuntime> {
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
        const runtime = new ReferenceDeviceRuntime(node, module)
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

    get input(): AudioWorkletNode {
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

    setErrorHandler(handler: (message: string) => void): void {
        this.errorHandler = handler
        this.node.port.addEventListener("message", this.errorListener)
        this.node.port.start()
    }

    connectOutput(output: AudioNode): void {
        this.node.disconnect()
        this.node.connect(output)
    }

    dispose(): void {
        this.node.port.removeEventListener("message", this.errorListener)
        this.errorHandler = undefined
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
                mode: "reference",
                moduleIndex,
                sampleRate,
                channels,
                maxFrames
            }, [wasmBytes])
        })
    }
}

export class KahuRackRuntime {
    private nextRequestId = 1
    private errorHandler: ((message: string) => void) | undefined
    private readonly errorListener = (event: MessageEvent<{type?: string, requestId?: number, message?: string}>): void => {
        if (event.data.type === "error" && event.data.requestId === undefined) {
            this.errorHandler?.(event.data.message ?? "Rust rack processing failed.")
        }
    }

    private constructor(private readonly node: AudioWorkletNode) {}

    static async create(context: AudioContext, channels: number, maxFrames: number): Promise<KahuRackRuntime> {
        await loadWorkletModule(context)
        const {wasmBytes} = await loadAssets()
        const node = new AudioWorkletNode(context, "kahu-dsp", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [channels]
        })
        const runtime = new KahuRackRuntime(node)
        try {
            await runtime.initialize(wasmBytes.slice(0), context.sampleRate, channels, maxFrames)
        } catch (error) {
            runtime.dispose()
            throw error
        }
        return runtime
    }

    get output(): AudioWorkletNode {
        return this.node
    }

    get input(): AudioWorkletNode {
        return this.node
    }

    async addDevice(module: KahuModuleManifest): Promise<KahuRackDeviceRuntime> {
        const response = await this.request({type: "add", moduleIndex: module.runtime.registry_index})
        if (response.type !== "added" || response.nodeId === undefined) throw new Error(response.message ?? "Rust rack module creation failed.")
        return new KahuRackDeviceRuntime(this, response.nodeId, module)
    }

    async removeDevice(nodeId: number): Promise<void> {
        await this.request({type: "remove", nodeId})
    }

    async moveDevice(nodeId: number, direction: -1 | 1): Promise<void> {
        await this.request({type: "move", nodeId, direction})
    }

    connectOutput(output: AudioNode): void {
        this.node.disconnect()
        this.node.connect(output)
    }

    reset(): void {
        this.node.port.postMessage({type: "reset"})
    }

    resetNode(nodeId: number): void {
        this.node.port.postMessage({type: "reset", nodeId})
    }

    setErrorHandler(handler: (message: string) => void): void {
        this.errorHandler = handler
        this.node.port.addEventListener("message", this.errorListener)
        this.node.port.start()
    }

    dispose(): void {
        this.node.port.removeEventListener("message", this.errorListener)
        this.errorHandler = undefined
        this.node.port.postMessage({type: "destroy"})
        this.node.disconnect()
    }

    private initialize(wasmBytes: ArrayBuffer, sampleRate: number, channels: number, maxFrames: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent<{type: string, message?: string}>): void => {
                if (event.data.type === "ready") {
                    this.node.port.removeEventListener("message", onMessage)
                    resolve()
                } else if (event.data.type === "error") {
                    this.node.port.removeEventListener("message", onMessage)
                    reject(new Error(event.data.message ?? "Rust rack initialization failed."))
                }
            }
            this.node.port.addEventListener("message", onMessage)
            this.node.port.start()
            this.node.port.postMessage({type: "init", wasmBytes, mode: "rack", sampleRate, channels, maxFrames}, [wasmBytes])
        })
    }

    private request(message: Record<string, unknown>): Promise<{type: string, nodeId?: number, message?: string}> {
        const requestId = this.nextRequestId++
        return new Promise((resolve, reject) => {
            const onMessage = (event: MessageEvent<{type: string, requestId?: number, nodeId?: number, message?: string}>): void => {
                if (event.data.requestId !== requestId) return
                this.node.port.removeEventListener("message", onMessage)
                if (event.data.type === "error") reject(new Error(event.data.message ?? "Rust rack control failed."))
                else resolve(event.data)
            }
            this.node.port.addEventListener("message", onMessage)
            this.node.port.postMessage({...message, requestId})
        })
    }
}

export class KahuRackDeviceRuntime {
    private readonly parameterIds = new Map<string, number>()
    private readonly parameterValues = new Map<number, number>()

    constructor(
        private readonly rack: KahuRackRuntime,
        private readonly nodeId: number,
        private readonly module: KahuModuleManifest,
    ) {
        for (const parameter of module.parameters) {
            this.parameterIds.set(parameter.key, parameter.id)
            this.parameterValues.set(parameter.id, parameter.default)
        }
    }

    get output(): AudioWorkletNode { return this.rack.output }
    get latency(): number { return this.module.runtime.latency_samples ?? 0 }
    get moduleId(): string { return this.module.id }
    get name(): string { return this.module.name }
    get parameters(): ReadonlyArray<KahuParameterManifest> { return this.module.parameters }

    parameterValue(key: string): number {
        const id = this.parameterIds.get(key)
        return id === undefined ? 0 : this.parameterValues.get(id) ?? 0
    }

    setParameter(key: string, value: number): void {
        const id = this.parameterIds.get(key)
        if (id === undefined) return
        this.parameterValues.set(id, value)
        this.rack.output.port.postMessage({type: "parameter", nodeId: this.nodeId, parameterId: id, value})
    }

    setBypassed(bypassed: boolean): void {
        this.rack.output.port.postMessage({type: "bypass", nodeId: this.nodeId, bypassed})
    }

    reset(): void { this.rack.resetNode(this.nodeId) }
    setErrorHandler(handler: (message: string) => void): void { this.rack.setErrorHandler(handler) }
    move(direction: -1 | 1): Promise<void> { return this.rack.moveDevice(this.nodeId, direction) }
    connectOutput(output: AudioNode): void { void output }
    dispose(): void { void this.rack.removeDevice(this.nodeId) }
}

export type KahuDeviceRuntime = ReferenceDeviceRuntime | KahuRackDeviceRuntime
