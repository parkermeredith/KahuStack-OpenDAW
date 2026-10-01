// KOD-2 transport authority: bounded play, pause, stop and seek state with no audio processing.

export type TransportSnapshot = Readonly<{
    positionSeconds: number
    isPlaying: boolean
    timecode: string
    musicalPosition: string
}>

export type TransportClock = () => number

export const DEFAULT_TRANSPORT_DURATION_SECONDS = 300
export const DEFAULT_TEMPO_BPM = 120

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

    constructor(
        private readonly clock: TransportClock = () => performance.now() / 1000,
        private readonly durationSeconds = DEFAULT_TRANSPORT_DURATION_SECONDS
    ) {}

    play(): void {
        this.updatePosition()
        if (this.positionSeconds >= this.durationSeconds) {
            this.positionSeconds = 0
        }
        if (!this.playing) {
            this.startedAtSeconds = this.clock()
            this.playing = true
        }
    }

    pause(): void {
        this.updatePosition()
        this.playing = false
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

    seek(seconds: number): void {
        this.positionSeconds = Math.min(this.durationSeconds, Math.max(0, seconds))
        if (this.playing) {
            this.startedAtSeconds = this.clock()
        }
    }

    snapshot(): TransportSnapshot {
        this.updatePosition()
        return {
            positionSeconds: this.positionSeconds,
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
        this.positionSeconds += now - this.startedAtSeconds
        this.startedAtSeconds = now
        if (this.positionSeconds >= this.durationSeconds) {
            this.positionSeconds = this.durationSeconds
            this.playing = false
        }
    }
}
