// KBW-3 transport authority: one sample-clock epoch for UI state and synchronized track scheduling.

export type TransportSnapshot = Readonly<{
    positionSeconds: number
    durationSeconds: number
    isPlaying: boolean
    timecode: string
    musicalPosition: string
}>

export type TransportClock = () => number
export type TransportEpoch = Readonly<{
    startTimeSeconds: number
    positionSeconds: number
}>

export const DEFAULT_TRANSPORT_DURATION_SECONDS = 300
export const DEFAULT_TEMPO_BPM = 120
export const DEFAULT_TRANSPORT_SAFETY_OFFSET_SECONDS = 0.01

export const formatTimecode = (seconds: number): string => {
    const hundredths = Math.max(0, Math.floor(seconds * 100))
    const minutes = Math.floor(hundredths / 6000)
    const remaining = hundredths % 6000
    const wholeSeconds = Math.floor(remaining / 100)
    const fractional = remaining % 100
    return `${minutes.toString().padStart(2, "0")}:${wholeSeconds.toString().padStart(2, "0")}:${fractional.toString().padStart(2, "0")}`
}

export const formatMusicalPosition = (seconds: number, tempoBpm = DEFAULT_TEMPO_BPM): string => {
    const beats = Math.max(0, Math.floor(seconds * tempoBpm / 60))
    return `${Math.floor(beats / 4) + 1}.${beats % 4 + 1}`
}

export class Transport {
    private positionSeconds = 0
    private startedAtSeconds = 0
    private playing = false
    private durationSeconds: number

    constructor(
        private readonly clock: TransportClock = () => performance.now() / 1000,
        durationSeconds = DEFAULT_TRANSPORT_DURATION_SECONDS,
        private readonly safetyOffsetSeconds = DEFAULT_TRANSPORT_SAFETY_OFFSET_SECONDS
    ) {
        this.durationSeconds = Math.max(0.01, durationSeconds)
    }

    setDuration(seconds: number): void {
        this.durationSeconds = Math.max(0.01, seconds)
        this.positionSeconds = Math.min(this.positionSeconds, this.durationSeconds)
    }

    play(): TransportEpoch {
        this.updatePosition()
        if (this.positionSeconds >= this.durationSeconds) {
            this.positionSeconds = 0
        }
        if (!this.playing) {
            return this.scheduleAt(this.positionSeconds)
        }
        return {startTimeSeconds: this.startedAtSeconds, positionSeconds: this.positionSeconds}
    }

    pause(): number {
        this.updatePosition()
        this.playing = false
        return this.positionSeconds
    }

    stop(): void {
        this.playing = false
        this.positionSeconds = 0
        this.startedAtSeconds = this.clock()
    }

    toggle(): void {
        if (this.playing) {
            this.pause()
        } else {
            this.play()
        }
    }

    seek(seconds: number): TransportEpoch | undefined {
        this.updatePosition()
        this.positionSeconds = Math.min(this.durationSeconds, Math.max(0, seconds))
        if (this.playing) {
            return this.scheduleAt(this.positionSeconds)
        }
        return undefined
    }

    reschedule(): TransportEpoch | undefined {
        if (!this.playing) return undefined
        this.updatePosition()
        return this.scheduleAt(this.positionSeconds)
    }

    snapshot(): TransportSnapshot {
        this.updatePosition()
        return {
            positionSeconds: this.positionSeconds,
            durationSeconds: this.durationSeconds,
            isPlaying: this.playing,
            timecode: formatTimecode(this.positionSeconds),
            musicalPosition: formatMusicalPosition(this.positionSeconds)
        }
    }

    private updatePosition(): void {
        if (!this.playing) {
            return
        }
        const now = this.clock()
        this.positionSeconds += Math.max(0, now - this.startedAtSeconds)
        this.startedAtSeconds = now
        if (this.positionSeconds >= this.durationSeconds) {
            this.positionSeconds = this.durationSeconds
            this.playing = false
        }
    }

    private scheduleAt(positionSeconds: number): TransportEpoch {
        const startTimeSeconds = this.clock() + Math.min(0.1, Math.max(0, this.safetyOffsetSeconds))
        this.startedAtSeconds = startTimeSeconds
        this.playing = true
        return {startTimeSeconds, positionSeconds}
    }
}
