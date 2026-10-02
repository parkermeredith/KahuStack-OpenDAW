// KBW-3/11/15/18 browser audio boundary: decodes admitted source audio, schedules it at a shared Web
// Audio epoch, and exposes bounded channel/monitor routing without owning DSP semantics.

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

export const playbackEndOffsetSeconds = (
    bufferDurationSeconds: number,
    sourceOffsetSeconds: number,
    durationSeconds?: number,
): number => {
    const bufferDuration = finiteNonNegative(bufferDurationSeconds)
    const sourceOffset = Math.min(bufferDuration, finiteNonNegative(sourceOffsetSeconds))
    if (durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return bufferDuration
    return Math.min(bufferDuration, sourceOffset + durationSeconds)
}

export const playbackPositionSeconds = (
    sourceOffsetSeconds: number,
    startTimeSeconds: number,
    currentTimeSeconds: number,
    endOffsetSeconds: number,
): number => {
    const startOffset = finiteNonNegative(sourceOffsetSeconds)
    const endOffset = Math.max(startOffset, finiteNonNegative(endOffsetSeconds))
    const elapsed = Number.isFinite(startTimeSeconds) && Number.isFinite(currentTimeSeconds)
        ? Math.max(0, currentTimeSeconds - startTimeSeconds)
        : 0
    return Math.min(endOffset, startOffset + elapsed)
}

export class AudioTrackPlayer {
    private source: AudioBufferSourceNode | undefined
    private buffer: AudioBuffer | undefined
    private startedAtSeconds = 0
    private offsetSeconds = 0
    private scheduledEndOffsetSeconds = 0
    private readonly gainNode: GainNode
    private readonly panNode: StereoPannerNode
    private readonly inputTrimNode: GainNode

    constructor(
        private readonly context: AudioContext,
        private readonly onEnded?: () => void,
        output: AudioNode = context.destination
    ) {
        this.gainNode = context.createGain()
        this.panNode = context.createStereoPanner()
        this.inputTrimNode = context.createGain()
        this.gainNode.connect(this.panNode)
        this.panNode.connect(this.inputTrimNode)
        this.inputTrimNode.connect(output)
    }

    load(buffer: AudioBuffer): void {
        this.stop()
        this.buffer = buffer
        this.offsetSeconds = 0
        this.scheduledEndOffsetSeconds = 0
    }

    clear(): void {
        this.stop()
        this.buffer = undefined
        this.offsetSeconds = 0
        this.scheduledEndOffsetSeconds = 0
    }

    playAt(startTimeSeconds: number, offsetSeconds = this.offsetSeconds, durationSeconds?: number): boolean {
        const buffer = this.buffer
        if (buffer === undefined) {
            return false
        }
        this.stopSource()
        const safeOffset = Math.min(buffer.duration, Math.max(0, offsetSeconds))
        const safeDuration = durationSeconds === undefined || !Number.isFinite(durationSeconds)
            ? undefined
            : Math.min(Math.max(0, durationSeconds), Math.max(0, buffer.duration - safeOffset))
        const endOffset = playbackEndOffsetSeconds(buffer.duration, safeOffset, safeDuration)
        const source = this.context.createBufferSource()
        source.buffer = buffer
        source.connect(this.gainNode)
        source.onended = () => {
            if (this.source === source) {
                this.source = undefined
                this.offsetSeconds = endOffset
                this.scheduledEndOffsetSeconds = endOffset
                this.onEnded?.()
            }
        }
        if (safeDuration === undefined || safeDuration <= 0) {
            source.start(startTimeSeconds, safeOffset)
        } else {
            source.start(startTimeSeconds, safeOffset, safeDuration)
        }
        this.source = source
        this.offsetSeconds = safeOffset
        this.scheduledEndOffsetSeconds = endOffset
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
        this.scheduledEndOffsetSeconds = 0
    }

    seek(offsetSeconds: number, startTimeSeconds?: number): void {
        const wasPlaying = this.source !== undefined
        this.offsetSeconds = this.clampOffset(offsetSeconds)
        this.scheduledEndOffsetSeconds = this.offsetSeconds
        if (wasPlaying) {
            this.playAt(startTimeSeconds ?? this.context.currentTime + 0.01, this.offsetSeconds)
        }
    }

    positionSeconds(): number {
        if (this.buffer === undefined) {
            return 0
        }
        if (this.source === undefined) {
            return this.offsetSeconds
        }
        return playbackPositionSeconds(
            this.offsetSeconds,
            this.startedAtSeconds,
            this.context.currentTime,
            this.scheduledEndOffsetSeconds,
        )
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

    setPan(pan: number): void {
        this.panNode.pan.setValueAtTime(Math.min(1, Math.max(-1, pan)), this.context.currentTime)
    }

    setOutput(output: AudioNode): void {
        this.inputTrimNode.disconnect()
        this.inputTrimNode.connect(output)
    }

    setComparisonOutputs(processedInput: AudioNode, dryOutput: AudioNode): void {
        this.inputTrimNode.disconnect()
        this.inputTrimNode.connect(processedInput)
        this.inputTrimNode.connect(dryOutput)
    }

    setInputTrim(gain: number): void {
        this.inputTrimNode.gain.setValueAtTime(Math.min(4, Math.max(0, gain)), this.context.currentTime)
    }

    private stopSource(): void {
        const source = this.source
        this.source = undefined
        this.scheduledEndOffsetSeconds = this.offsetSeconds
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

const finiteNonNegative = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0
