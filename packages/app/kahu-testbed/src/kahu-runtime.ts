// KOD-6 host bridge: loads generated Kahu metadata/WASM and owns AudioWorklet lifecycle only.

type ManifestParameter = Readonly<{id: number, key: string, default: number}>
type ManifestModule = Readonly<{
    id: string
    name: string
    runtime: Readonly<{registry_index: number, latency_samples: number}>
    parameters: ReadonlyArray<ManifestParameter>
}>
type LibraryManifest = Readonly<{modules: ReadonlyArray<ManifestModule>}>

const WASM_URL = "/kahu-runtime/kahu_dsp_wasm.wasm"
const MANIFEST_URL = "/kahu-runtime/library-manifest.json"
let workletModule: Promise<void> | undefined

const loadWorkletModule = (context: AudioContext): Promise<void> => {
    workletModule ??= context.audioWorklet.addModule("/worklets/kahu-gain-worklet.js")
    return workletModule
}

export class KahuGainRuntime {
    private readonly node: AudioWorkletNode
    private readonly gainParameterId: number
    private readonly latencySamples: number
    private ready = false
    private gainDb = 0

    private constructor(node: AudioWorkletNode, parameterId: number, latencySamples: number) {
        this.node = node
        this.gainParameterId = parameterId
        this.latencySamples = latencySamples
    }

    static async create(context: AudioContext, channels: number, maxFrames: number): Promise<KahuGainRuntime> {
        await loadWorkletModule(context)
        const [wasmResponse, manifestResponse] = await Promise.all([fetch(WASM_URL), fetch(MANIFEST_URL)])
        if (!wasmResponse.ok || !manifestResponse.ok) {
            throw new Error("Kahu Rust-WASM runtime assets are unavailable; run the parent build staging step.")
        }
        const [wasmBytes, rawManifest] = await Promise.all([wasmResponse.arrayBuffer(), manifestResponse.json() as Promise<LibraryManifest>])
        const module = rawManifest.modules.find(candidate => candidate.id === "utility.gain")
        const parameter = module?.parameters.find(candidate => candidate.key === "gain_db")
        if (module === undefined || parameter === undefined) {
            throw new Error("Generated Kahu manifest does not contain utility.gain/gain_db.")
        }
        const node = new AudioWorkletNode(context, "kahu-gain", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [channels]
        })
        node.connect(context.destination)
        const runtime = new KahuGainRuntime(node, parameter.id, module.runtime.latency_samples)
        try {
            await runtime.initialize(wasmBytes, module.runtime.registry_index, context.sampleRate, channels, maxFrames)
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

    get gain(): number {
        return this.gainDb
    }

    setGainDb(value: number): void {
        this.gainDb = value
        if (this.ready) {
            this.node.port.postMessage({type: "parameter", parameterId: this.gainParameterId, value})
        }
    }

    setBypassed(bypassed: boolean): void {
        this.node.port.postMessage({type: "bypass", bypassed})
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
