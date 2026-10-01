// KOD-3 browser audio boundary: decodes admitted source audio and schedules it through Web Audio.

export type DecodedAudioFile = Readonly<{
    name: string
    durationSeconds: number
    sampleRate: number
    channelCount: number
    buffer: AudioBuffer
}>

export const decodeAudioFile = async (context: BaseAudioContext, file: File): Promise<DecodedAudioFile> => {
    const buffer = await context.decodeAudioData(await file.arrayBuffer())
    return {
        name: file.name,
        durationSeconds: buffer.duration,
        sampleRate: buffer.sampleRate,
        channelCount: buffer.numberOfChannels,
        buffer
    }
}

export class AudioTrackPlayer {
    private source: AudioBufferSourceNode | undefined
    private buffer: AudioBuffer | undefined
    private startedAtSeconds = 0
    private offsetSeconds = 0

    constructor(private readonly context: AudioContext, private readonly onEnded?: () => void) {}

    load(buffer: AudioBuffer): void {
        this.stop()
        this.buffer = buffer
        this.offsetSeconds = 0
    }

    clear(): void {
        this.stop()
        this.buffer = undefined
        this.offsetSeconds = 0
    }

    play(offsetSeconds = this.offsetSeconds): boolean {
        const buffer = this.buffer
        if (buffer === undefined) {
            return false
        }
        this.stop()
        const safeOffset = Math.min(buffer.duration, Math.max(0, offsetSeconds))
        const source = this.context.createBufferSource()
        source.buffer = buffer
        source.connect(this.context.destination)
        source.onended = () => {
            if (this.source === source) {
                this.source = undefined
                this.offsetSeconds = buffer.duration
                this.onEnded?.()
            }
        }
        source.start(0, safeOffset)
        this.source = source
        this.offsetSeconds = safeOffset
        this.startedAtSeconds = this.context.currentTime - safeOffset
        return true
    }

    pause(): void {
        this.offsetSeconds = this.positionSeconds()
        this.stopSource()
    }

    stop(): void {
        this.stopSource()
        this.offsetSeconds = 0
    }

    seek(offsetSeconds: number): void {
        const wasPlaying = this.source !== undefined
        this.offsetSeconds = this.clampOffset(offsetSeconds)
        if (wasPlaying) {
            this.play(this.offsetSeconds)
        }
    }

    positionSeconds(): number {
        const buffer = this.buffer
        if (buffer === undefined) {
            return 0
        }
        if (this.source === undefined) {
            return this.offsetSeconds
        }
        return this.clampOffset(this.context.currentTime - this.startedAtSeconds)
    }

    hasAudio(): boolean {
        return this.buffer !== undefined
    }

    private stopSource(): void {
        const source = this.source
        this.source = undefined
        if (source !== undefined) {
            source.onended = null
            source.stop()
            source.disconnect()
        }
    }

    private clampOffset(offsetSeconds: number): number {
        return Math.min(this.buffer?.duration ?? 0, Math.max(0, offsetSeconds))
    }
}
