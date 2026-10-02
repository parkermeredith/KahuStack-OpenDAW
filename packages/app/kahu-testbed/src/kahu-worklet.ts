// KBW-7 realtime boundary: transports reference devices and the consolidated Rust-WASM rack.
// The processor copies bounded AudioWorklet quanta into prepared Rust buffers and performs no
// allocation, logging, or host I/O from `process`.

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
    kahu_rack_process: (handle: number, frames: number) => number
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
} | {readonly type: "reset"} | {
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

class KahuDspProcessor extends AudioWorkletProcessor {
    private wasm: WasmExports | undefined
    private handle = 0
    private inputPointer = 0
    private outputPointer = 0
    private channels = 0
    private maxFrames = 0
    private mode: "reference" | "rack" = "reference"
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
            if (this.mode === "rack") this.wasm.kahu_rack_reset(this.handle)
            else this.wasm.kahu_reset(this.handle)
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
            this.handle = message.mode === "rack"
                ? this.wasm.kahu_rack_create(message.sampleRate, message.channels, message.maxFrames)
                : this.wasm.kahu_create(message.moduleIndex ?? 0, message.sampleRate, message.channels, message.maxFrames)
            if (this.handle === 0) throw new Error("Rust-WASM runtime creation returned a null handle.")
            this.inputPointer = message.mode === "rack" ? this.wasm.kahu_rack_input_ptr(this.handle) : this.wasm.kahu_input_ptr(this.handle)
            this.outputPointer = message.mode === "rack" ? this.wasm.kahu_rack_output_ptr(this.handle) : this.wasm.kahu_output_ptr(this.handle)
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
        const status = this.mode === "rack" ? wasm.kahu_rack_process(this.handle, frames) : wasm.kahu_process(this.handle, frames)
        if (status !== 0) return false
        const outputMemory = new Float32Array(wasm.memory.buffer, this.outputPointer, this.channels * frames)
        for (let channel = 0; channel < output.length; channel++) {
            const target = output[channel]
            const channelOffset = channel * frames
            for (let frame = 0; frame < target.length - offset; frame++) target[offset + frame] = outputMemory[channelOffset + frame] ?? 0
        }
        return true
    }

    private copyInput(input: Float32Array[], output: Float32Array[]): void {
        for (let channel = 0; channel < output.length; channel++) {
            const source = input[channel]
            const target = output[channel]
            for (let frame = 0; frame < target.length; frame++) target[frame] = source?.[frame] ?? 0
        }
    }

    private dispose(): void {
        if (this.wasm !== undefined && this.handle !== 0) {
            if (this.mode === "rack") this.wasm.kahu_rack_destroy(this.handle)
            else this.wasm.kahu_destroy(this.handle)
        }
        this.wasm = undefined
        this.handle = 0
        this.inputPointer = 0
        this.outputPointer = 0
    }
}

registerProcessor("kahu-dsp", KahuDspProcessor)
