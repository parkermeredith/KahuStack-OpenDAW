// KOD-6 realtime boundary: copies AudioWorklet quanta through the canonical Rust-WASM ABI.

declare function registerProcessor(
    name: string,
    processor: new () => AudioWorkletProcessor
): void

type WasmExports = {
    memory: WebAssembly.Memory
    kahu_create: (moduleIndex: number, sampleRate: number, channels: number, maxFrames: number) => number
    kahu_destroy: (handle: number) => void
    kahu_input_ptr: (handle: number) => number
    kahu_output_ptr: (handle: number) => number
    kahu_set_parameter: (handle: number, parameterId: number, value: number) => number
    kahu_reset: (handle: number) => number
    kahu_process: (handle: number, frames: number) => number
}

type InitMessage = {
    readonly type: "init"
    readonly wasmBytes: ArrayBuffer
    readonly moduleIndex: number
    readonly sampleRate: number
    readonly channels: number
    readonly maxFrames: number
}

type WorkletMessage = InitMessage | {
    readonly type: "parameter"
    readonly parameterId: number
    readonly value: number
} | {
    readonly type: "bypass"
    readonly bypassed: boolean
} | {
    readonly type: "reset"
} | {
    readonly type: "destroy"
}

class KahuGainProcessor extends AudioWorkletProcessor {
    private wasm: WasmExports | undefined
    private handle = 0
    private inputPointer = 0
    private outputPointer = 0
    private channels = 0
    private maxFrames = 0
    private bypassed = false
    private failed = false

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
        if (message.type === "parameter" && this.wasm !== undefined && this.handle !== 0) {
            const status = this.wasm.kahu_set_parameter(this.handle, message.parameterId, message.value)
            if (status !== 0) {
                this.port.postMessage({type: "error", message: `Rust parameter update failed: ${status}`})
            }
            return
        }
        if (message.type === "bypass") {
            this.bypassed = message.bypassed
            this.port.postMessage({type: "bypass", bypassed: this.bypassed})
            return
        }
        if (message.type === "reset" && this.wasm !== undefined && this.handle !== 0) {
            this.wasm.kahu_reset(this.handle)
            return
        }
        if (message.type === "destroy") {
            this.dispose()
        }
    }

    private async initialize(message: InitMessage): Promise<void> {
        try {
            this.dispose()
            const result = await WebAssembly.instantiate(message.wasmBytes, {})
            this.wasm = result.instance.exports as unknown as WasmExports
            this.channels = message.channels
            this.maxFrames = message.maxFrames
            this.handle = this.wasm.kahu_create(
                message.moduleIndex,
                message.sampleRate,
                message.channels,
                message.maxFrames
            )
            if (this.handle === 0) {
                throw new Error("Rust-WASM module creation returned a null handle.")
            }
            this.inputPointer = this.wasm.kahu_input_ptr(this.handle)
            this.outputPointer = this.wasm.kahu_output_ptr(this.handle)
            this.failed = false
            this.port.postMessage({type: "ready"})
        } catch (error) {
            this.wasm = undefined
            this.handle = 0
            this.port.postMessage({type: "error", message: error instanceof Error ? error.message : "Rust-WASM initialization failed."})
        }
    }

    private processBlock(
        input: Float32Array[],
        output: Float32Array[],
        offset: number,
        frames: number
    ): boolean {
        const wasm = this.wasm
        if (wasm === undefined) {
            return false
        }
        const inputMemory = new Float32Array(wasm.memory.buffer, this.inputPointer, this.channels * frames)
        for (let channel = 0; channel < this.channels; channel++) {
            const source = input[channel]
            const channelOffset = channel * frames
            for (let frame = 0; frame < frames; frame++) {
                inputMemory[channelOffset + frame] = source?.[offset + frame] ?? 0
            }
        }
        if (wasm.kahu_process(this.handle, frames) !== 0) {
            return false
        }
        const outputMemory = new Float32Array(wasm.memory.buffer, this.outputPointer, this.channels * frames)
        for (let channel = 0; channel < output.length; channel++) {
            const target = output[channel]
            const channelOffset = channel * frames
            for (let frame = 0; frame < target.length - offset; frame++) {
                target[offset + frame] = outputMemory[channelOffset + frame] ?? 0
            }
        }
        return true
    }

    private copyInput(input: Float32Array[], output: Float32Array[]): void {
        for (let channel = 0; channel < output.length; channel++) {
            const source = input[channel]
            const target = output[channel]
            for (let frame = 0; frame < target.length; frame++) {
                target[frame] = source?.[frame] ?? 0
            }
        }
    }

    private dispose(): void {
        if (this.wasm !== undefined && this.handle !== 0) {
            this.wasm.kahu_destroy(this.handle)
        }
        this.wasm = undefined
        this.handle = 0
        this.inputPointer = 0
        this.outputPointer = 0
    }
}

registerProcessor("kahu-gain", KahuGainProcessor)
