// KBW-7 realtime boundary: transports reference devices and the consolidated Rust-WASM rack.
// The processor copies bounded AudioWorklet quanta into prepared Rust buffers and performs no
// blocking I/O or DSP in JavaScript. Kahu-owned meter/spectrum observers are presentation-decimated
// and never alter the realtime rack result.

declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void

type WasmExports = {
    memory: WebAssembly.Memory
    kahu_create: (moduleIndex: number, sampleRate: number, channels: number, maxFrames: number) => number
    kahu_destroy: (handle: number) => void
    kahu_input_ptr: (handle: number) => number
    kahu_output_ptr: (handle: number) => number
    kahu_set_parameter: (handle: number, parameterId: number, value: number) => number
    kahu_reset: (handle: number) => number
    kahu_process: (handle: number, frames: number) => number
    kahu_rack_create: (sampleRate: number, channels: number, maxFrames: number) => number
    kahu_rack_destroy: (handle: number) => void
    kahu_rack_input_ptr: (handle: number) => number
    kahu_rack_output_ptr: (handle: number) => number
    kahu_rack_add: (handle: number, moduleIndex: number) => number
    kahu_rack_remove: (handle: number, nodeId: number) => number
    kahu_rack_move: (handle: number, nodeId: number, direction: number) => number
    kahu_rack_set_bypassed: (handle: number, nodeId: number, bypassed: number) => number
    kahu_rack_set_parameter: (handle: number, nodeId: number, parameterId: number, value: number) => number
    kahu_rack_reset: (handle: number) => number
    kahu_rack_reset_node: (handle: number, nodeId: number) => number
    kahu_rack_process: (handle: number, frames: number) => number
    kahu_meter_create_profile: (sampleRate: number, channels: number, maxFrames: number, maxProgramSeconds: number, profile: number) => number
    kahu_meter_destroy: (handle: number) => void
    kahu_meter_input_ptr: (handle: number) => number
    kahu_meter_process: (handle: number, frames: number) => number
    kahu_meter_realtime_value: (handle: number, valueId: number) => number
    kahu_perceptual_spectrum_create: (sampleRate: number, frameLength: number, hopLength: number, channels: number, maxFrames: number) => number
    kahu_perceptual_spectrum_destroy: (handle: number) => void
    kahu_perceptual_spectrum_input_ptr: (handle: number) => number
    kahu_perceptual_spectrum_reset: (handle: number) => number
    kahu_perceptual_spectrum_process: (handle: number, frames: number) => number
    kahu_perceptual_spectrum_snapshot_available: (handle: number) => number
    kahu_perceptual_spectrum_erb_band_count: (handle: number) => number
    kahu_perceptual_spectrum_erb_power_ptr: (handle: number) => number
}

type InitMessage = {
    readonly type: "init"
    readonly wasmBytes: ArrayBuffer
    readonly mode: "reference" | "rack"
    readonly moduleIndex?: number
    readonly sampleRate: number
    readonly channels: number
    readonly maxFrames: number
}

type WorkletMessage = InitMessage | {
    readonly type: "parameter"
    readonly nodeId?: number
    readonly parameterId: number
    readonly value: number
} | {
    readonly type: "bypass"
    readonly nodeId?: number
    readonly bypassed: boolean
} | {readonly type: "reset", readonly nodeId?: number} | {
    readonly type: "add"
    readonly requestId: number
    readonly moduleIndex: number
} | {
    readonly type: "remove"
    readonly requestId: number
    readonly nodeId: number
} | {
    readonly type: "move"
    readonly requestId: number
    readonly nodeId: number
    readonly direction: -1 | 1
} | {readonly type: "destroy"}

type KahuAnalysisMessage = Readonly<{
    type: "analysis"
    processedMomentaryLufs: number | null
    dryMomentaryLufs: number | null
    spectrum: Float32Array
    spectrumBandCount: number
}>

class KahuDspProcessor extends AudioWorkletProcessor {
    private wasm: WasmExports | undefined
    private handle = 0
    private inputPointer = 0
    private outputPointer = 0
    private channels = 0
    private maxFrames = 0
    private sampleRate = 0
    private mode: "reference" | "rack" = "reference"
    private bypassed = false
    private failed = false
    private meterHandle = 0
    private dryMeterHandle = 0
    private meterInputPointer = 0
    private dryMeterInputPointer = 0
    private spectrumHandle = 0
    private spectrumInputPointer = 0
    private spectrumBandCount = 0
    private readonly spectrumValues = new Float32Array(64)
    private analysisFrames = 0
    private analysisErrorPosted = false

    constructor() {
        super()
        this.port.onmessage = event => { void this.handleMessage(event.data as WorkletMessage) }
    }

    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
        const input = inputs[0] ?? []
        const output = outputs[0] ?? []
        if (this.wasm === undefined || this.handle === 0 || this.bypassed || this.failed) {
            this.copyInput(input, output)
            return true
        }
        const frames = output[0]?.length ?? 0
        for (let offset = 0; offset < frames; offset += this.maxFrames) {
            const blockFrames = Math.min(this.maxFrames, frames - offset)
            if (!this.processBlock(input, output, offset, blockFrames)) {
                this.failed = true
                this.copyInput(input, output)
                this.port.postMessage({type: "error", message: "Rust-WASM processing failed; bypassing output."})
                break
            }
        }
        return true
    }

    private async handleMessage(message: WorkletMessage): Promise<void> {
        if (message.type === "init") {
            await this.initialize(message)
            return
        }
        if (message.type === "add" && this.mode === "rack" && this.wasm !== undefined && this.handle !== 0) {
            const nodeId = this.wasm.kahu_rack_add(this.handle, message.moduleIndex)
            this.port.postMessage(nodeId === 0
                ? {type: "error", requestId: message.requestId, message: "Rust rack module creation failed."}
                : {type: "added", requestId: message.requestId, nodeId})
            return
        }
        if (message.type === "remove" && this.mode === "rack" && this.wasm !== undefined && this.handle !== 0) {
            const status = this.wasm.kahu_rack_remove(this.handle, message.nodeId)
            this.port.postMessage(status === 0
                ? {type: "complete", requestId: message.requestId}
                : {type: "error", requestId: message.requestId, message: `Rust rack removal failed: ${status}`})
            return
        }
        if (message.type === "move" && this.mode === "rack" && this.wasm !== undefined && this.handle !== 0) {
            const status = this.wasm.kahu_rack_move(this.handle, message.nodeId, message.direction)
            this.port.postMessage(status === 0
                ? {type: "complete", requestId: message.requestId}
                : {type: "error", requestId: message.requestId, message: `Rust rack reorder failed: ${status}`})
            return
        }
        if (message.type === "parameter" && this.wasm !== undefined && this.handle !== 0) {
            const status = this.mode === "rack"
                ? this.wasm.kahu_rack_set_parameter(this.handle, message.nodeId ?? 0, message.parameterId, message.value)
                : this.wasm.kahu_set_parameter(this.handle, message.parameterId, message.value)
            if (status !== 0) this.port.postMessage({type: "error", message: `Rust parameter update failed: ${status}`})
            return
        }
        if (message.type === "bypass") {
            if (this.mode === "rack" && this.wasm !== undefined && this.handle !== 0) {
                const status = this.wasm.kahu_rack_set_bypassed(this.handle, message.nodeId ?? 0, message.bypassed ? 1 : 0)
                if (status !== 0) this.port.postMessage({type: "error", message: `Rust rack bypass failed: ${status}`})
            } else {
                this.bypassed = message.bypassed
            }
            this.port.postMessage({type: "bypass", bypassed: message.bypassed})
            return
        }
        if (message.type === "reset" && this.wasm !== undefined && this.handle !== 0) {
            const status = this.mode === "rack"
                ? message.nodeId === undefined
                    ? this.wasm.kahu_rack_reset(this.handle)
                    : this.wasm.kahu_rack_reset_node(this.handle, message.nodeId)
                : this.wasm.kahu_reset(this.handle)
            if (status !== 0) this.port.postMessage({type: "error", message: `Rust reset failed: ${status}`})
            if (this.meterHandle !== 0) this.wasm.kahu_meter_destroy(this.meterHandle)
            if (this.dryMeterHandle !== 0) this.wasm.kahu_meter_destroy(this.dryMeterHandle)
            this.meterHandle = this.wasm.kahu_meter_create_profile(this.sampleRate, this.channels, this.maxFrames, 600, 1)
            this.dryMeterHandle = this.wasm.kahu_meter_create_profile(this.sampleRate, this.channels, this.maxFrames, 600, 1)
            this.meterInputPointer = this.meterHandle === 0 ? 0 : this.wasm.kahu_meter_input_ptr(this.meterHandle)
            this.dryMeterInputPointer = this.dryMeterHandle === 0 ? 0 : this.wasm.kahu_meter_input_ptr(this.dryMeterHandle)
            if (this.spectrumHandle !== 0) this.wasm.kahu_perceptual_spectrum_reset(this.spectrumHandle)
            this.analysisFrames = 0
            return
        }
        if (message.type === "destroy") this.dispose()
    }

    private async initialize(message: InitMessage): Promise<void> {
        try {
            this.dispose()
            const result = await WebAssembly.instantiate(message.wasmBytes, {})
            this.wasm = result.instance.exports as unknown as WasmExports
            this.mode = message.mode
            this.channels = message.channels
            this.maxFrames = message.maxFrames
            this.sampleRate = message.sampleRate
            this.handle = message.mode === "rack"
                ? this.wasm.kahu_rack_create(message.sampleRate, message.channels, message.maxFrames)
                : this.wasm.kahu_create(message.moduleIndex ?? 0, message.sampleRate, message.channels, message.maxFrames)
            if (this.handle === 0) throw new Error("Rust-WASM runtime creation returned a null handle.")
            this.inputPointer = message.mode === "rack" ? this.wasm.kahu_rack_input_ptr(this.handle) : this.wasm.kahu_input_ptr(this.handle)
            this.outputPointer = message.mode === "rack" ? this.wasm.kahu_rack_output_ptr(this.handle) : this.wasm.kahu_output_ptr(this.handle)
            this.prepareObservers(message.sampleRate)
            this.failed = false
            this.port.postMessage({type: "ready"})
        } catch (error) {
            this.wasm = undefined
            this.handle = 0
            this.port.postMessage({type: "error", message: error instanceof Error ? error.message : "Rust-WASM initialization failed."})
        }
    }

    private processBlock(input: Float32Array[], output: Float32Array[], offset: number, frames: number): boolean {
        const wasm = this.wasm
        if (wasm === undefined) return false
        const inputMemory = new Float32Array(wasm.memory.buffer, this.inputPointer, this.channels * frames)
        for (let channel = 0; channel < this.channels; channel++) {
            const source = input[channel]
            const channelOffset = channel * frames
            for (let frame = 0; frame < frames; frame++) inputMemory[channelOffset + frame] = source?.[offset + frame] ?? 0
        }
        this.observeDryInput(input, offset, frames)
        const status = this.mode === "rack" ? wasm.kahu_rack_process(this.handle, frames) : wasm.kahu_process(this.handle, frames)
        if (status !== 0) return false
        const outputMemory = new Float32Array(wasm.memory.buffer, this.outputPointer, this.channels * frames)
        for (let channel = 0; channel < output.length; channel++) {
            const target = output[channel]
            const channelOffset = channel * frames
            for (let frame = 0; frame < target.length - offset; frame++) target[offset + frame] = outputMemory[channelOffset + frame] ?? 0
        }
        this.observeProcessedOutput(outputMemory, frames)
        return true
    }

    private prepareObservers(sampleRate: number): void {
        const wasm = this.wasm
        if (wasm === undefined) return
        this.analysisErrorPosted = false
        try {
            this.meterHandle = wasm.kahu_meter_create_profile(sampleRate, this.channels, this.maxFrames, 600, 1)
            this.dryMeterHandle = wasm.kahu_meter_create_profile(sampleRate, this.channels, this.maxFrames, 600, 1)
            this.meterInputPointer = this.meterHandle === 0 ? 0 : wasm.kahu_meter_input_ptr(this.meterHandle)
            this.dryMeterInputPointer = this.dryMeterHandle === 0 ? 0 : wasm.kahu_meter_input_ptr(this.dryMeterHandle)
            this.spectrumHandle = wasm.kahu_perceptual_spectrum_create(sampleRate, 256, 128, this.channels, this.maxFrames)
            this.spectrumInputPointer = this.spectrumHandle === 0 ? 0 : wasm.kahu_perceptual_spectrum_input_ptr(this.spectrumHandle)
            this.spectrumBandCount = this.spectrumHandle === 0
                ? 0
                : Math.min(this.spectrumValues.length, wasm.kahu_perceptual_spectrum_erb_band_count(this.spectrumHandle))
            if (this.meterHandle === 0 || this.dryMeterHandle === 0 || this.spectrumHandle === 0) {
                throw new Error("Kahu analysis observers could not prepare.")
            }
        } catch (error) {
            this.analysisErrorPosted = true
            this.port.postMessage({type: "analysis-error", message: error instanceof Error ? error.message : "Kahu analysis observers failed."})
        }
    }

    private observeDryInput(input: Float32Array[], offset: number, frames: number): void {
        const wasm = this.wasm
        if (wasm === undefined || this.dryMeterHandle === 0 || this.dryMeterInputPointer === 0) return
        const memory = new Float32Array(wasm.memory.buffer, this.dryMeterInputPointer, this.channels * frames)
        for (let channel = 0; channel < this.channels; channel++) {
            const source = input[channel]
            const channelOffset = channel * frames
            for (let frame = 0; frame < frames; frame++) memory[channelOffset + frame] = source?.[offset + frame] ?? 0
        }
        if (wasm.kahu_meter_process(this.dryMeterHandle, frames) !== 0) this.postAnalysisError("Kahu dry level-match meter failed.")
    }

    private observeProcessedOutput(output: Float32Array, frames: number): void {
        const wasm = this.wasm
        if (wasm === undefined) return
        if (this.meterHandle !== 0 && this.meterInputPointer !== 0) {
            const memory = new Float32Array(wasm.memory.buffer, this.meterInputPointer, this.channels * frames)
            memory.set(output)
            if (wasm.kahu_meter_process(this.meterHandle, frames) !== 0) this.postAnalysisError("Kahu processed level-match meter failed.")
        }
        if (this.spectrumHandle !== 0 && this.spectrumInputPointer !== 0) {
            const memory = new Float32Array(wasm.memory.buffer, this.spectrumInputPointer, this.channels * frames)
            memory.set(output)
            if (wasm.kahu_perceptual_spectrum_process(this.spectrumHandle, frames) < 0) this.postAnalysisError("Kahu perceptual spectrum processing failed.")
        }
        this.analysisFrames += frames
        if (this.analysisFrames >= Math.max(1, Math.round(this.sampleRate / 10))) {
            this.analysisFrames = 0
            this.postAnalysis()
        }
    }

    private postAnalysisError(message: string): void {
        if (this.analysisErrorPosted) return
        this.analysisErrorPosted = true
        this.port.postMessage({type: "analysis-error", message})
    }

    private postAnalysis(): void {
        const wasm = this.wasm
        if (wasm === undefined || this.meterHandle === 0 || this.dryMeterHandle === 0) return
        if (this.spectrumHandle !== 0 && wasm.kahu_perceptual_spectrum_snapshot_available(this.spectrumHandle) !== 0) {
            const pointer = wasm.kahu_perceptual_spectrum_erb_power_ptr(this.spectrumHandle)
            if (pointer !== 0) {
                const source = new Float32Array(wasm.memory.buffer, pointer, this.spectrumBandCount)
                this.spectrumValues.fill(0)
                this.spectrumValues.set(source)
            }
        }
        const message: KahuAnalysisMessage = {
            type: "analysis",
            processedMomentaryLufs: finiteOrNull(wasm.kahu_meter_realtime_value(this.meterHandle, 0)),
            dryMomentaryLufs: finiteOrNull(wasm.kahu_meter_realtime_value(this.dryMeterHandle, 0)),
            spectrum: this.spectrumValues,
            spectrumBandCount: this.spectrumBandCount,
        }
        this.port.postMessage(message)
    }

    private copyInput(input: Float32Array[], output: Float32Array[]): void {
        for (let channel = 0; channel < output.length; channel++) {
            const source = input[channel]
            const target = output[channel]
            for (let frame = 0; frame < target.length; frame++) target[frame] = source?.[frame] ?? 0
        }
    }

    private dispose(): void {
        if (this.wasm !== undefined) {
            if (this.meterHandle !== 0) this.wasm.kahu_meter_destroy(this.meterHandle)
            if (this.dryMeterHandle !== 0) this.wasm.kahu_meter_destroy(this.dryMeterHandle)
            if (this.spectrumHandle !== 0) this.wasm.kahu_perceptual_spectrum_destroy(this.spectrumHandle)
        }
        if (this.wasm !== undefined && this.handle !== 0) {
            if (this.mode === "rack") this.wasm.kahu_rack_destroy(this.handle)
            else this.wasm.kahu_destroy(this.handle)
        }
        this.wasm = undefined
        this.handle = 0
        this.inputPointer = 0
        this.outputPointer = 0
        this.sampleRate = 0
        this.meterHandle = 0
        this.dryMeterHandle = 0
        this.meterInputPointer = 0
        this.dryMeterInputPointer = 0
        this.spectrumHandle = 0
        this.spectrumInputPointer = 0
        this.spectrumBandCount = 0
        this.analysisFrames = 0
    }
}

const finiteOrNull = (value: number): number | null => Number.isFinite(value) ? value : null

registerProcessor("kahu-dsp", KahuDspProcessor)
