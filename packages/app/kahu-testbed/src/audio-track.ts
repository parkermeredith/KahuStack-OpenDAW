// KBW-3 browser audio boundary: decodes admitted source audio and schedules it at a shared Web Audio epoch.

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
    private readonly gainNode: GainNode

    constructor(
        private readonly context: AudioContext,
        private readonly onEnded?: () => void,
        output: AudioNode = context.destination
    ) {
        this.gainNode = context.createGain()
        this.gainNode.connect(output)
    }

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

    playAt(startTimeSeconds: number, offsetSeconds = this.offsetSeconds, durationSeconds?: number): boolean {
        const buffer = this.buffer
        if (buffer === undefined) {
            return false
        }
        this.stop()
        const safeOffset = Math.min(buffer.duration, Math.max(0, offsetSeconds))
        const source = this.context.createBufferSource()
        source.buffer = buffer
        source.connect(this.gainNode)
        source.onended = () => {
            if (this.source === source) {
                this.source = undefined
                this.offsetSeconds = buffer.duration
                this.onEnded?.()
            }
        }
        const safeDuration = durationSeconds === undefined
            ? undefined
            : Math.min(Math.max(0, durationSeconds), Math.max(0, buffer.duration - safeOffset))
        if (safeDuration === undefined || safeDuration <= 0) {
            source.start(startTimeSeconds, safeOffset)
        } else {
            source.start(startTimeSeconds, safeOffset, safeDuration)
        }
        this.source = source
        this.offsetSeconds = safeOffset
        this.startedAtSeconds = startTimeSeconds
        return true
    }

    pauseAt(offsetSeconds = this.positionSeconds()): void {
        this.offsetSeconds = this.clampOffset(offsetSeconds)
        this.stopSource()
    }

    play(offsetSeconds = this.offsetSeconds): boolean {
        return this.playAt(this.context.currentTime + 0.01, offsetSeconds)
    }

    stop(): void {
        this.stopSource()
        this.offsetSeconds = 0
    }

    seek(offsetSeconds: number, startTimeSeconds?: number): void {
        const wasPlaying = this.source !== undefined
        this.offsetSeconds = this.clampOffset(offsetSeconds)
        if (wasPlaying) {
            this.playAt(startTimeSeconds ?? this.context.currentTime + 0.01, this.offsetSeconds)
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

    isPlaying(): boolean {
        return this.source !== undefined
    }

    setGain(gain: number): void {
        this.gainNode.gain.setValueAtTime(Math.min(1, Math.max(0, gain)), this.context.currentTime)
    }

    setOutput(output: AudioNode): void {
        this.gainNode.disconnect()
        this.gainNode.connect(output)
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
