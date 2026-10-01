// KBW-6 timeline authority: bounded viewport math for horizontal zoom, scroll, seek, and region layout.
// It intentionally models only audio-track lanes; it is not a general DAW timeline.

export type TimelineViewportSnapshot = Readonly<{
    durationSeconds: number
    zoom: number
    scrollFraction: number
    visibleDurationSeconds: number
}>

export class TimelineViewport {
    private durationSeconds = 300
    private zoom = 1
    private scrollFraction = 0

    setDuration(durationSeconds: number): void {
        this.durationSeconds = Math.max(0.01, durationSeconds)
        this.clampScroll()
    }

    setZoom(zoom: number): void {
        this.zoom = Math.min(8, Math.max(1, zoom))
        this.clampScroll()
    }

    setScrollFraction(fraction: number): void {
        this.scrollFraction = Math.min(1, Math.max(0, fraction))
    }

    snapshot(): TimelineViewportSnapshot {
        return {
            durationSeconds: this.durationSeconds,
            zoom: this.zoom,
            scrollFraction: this.scrollFraction,
            visibleDurationSeconds: this.visibleDurationSeconds(),
        }
    }

    contentWidthPercent(): number {
        return this.zoom * 100
    }

    visibleStartSeconds(): number {
        return this.scrollFraction * Math.max(0, this.durationSeconds - this.visibleDurationSeconds())
    }

    visibleDurationSeconds(): number {
        return this.durationSeconds / this.zoom
    }

    secondsAtX(x: number, width: number): number {
        const fraction = width <= 0 ? 0 : Math.min(1, Math.max(0, x / width))
        return Math.min(
            this.durationSeconds,
            this.visibleStartSeconds() + fraction * this.visibleDurationSeconds(),
        )
    }

    positionPercent(seconds: number): number {
        return Math.max(0, Math.min(this.durationSeconds, seconds)) / this.durationSeconds * 100
    }

    regionStyle(startSeconds: number, durationSeconds: number): Readonly<{leftPercent: number, widthPercent: number}> {
        return {
            leftPercent: startSeconds / this.durationSeconds * 100,
            widthPercent: durationSeconds / this.durationSeconds * 100,
        }
    }

    private clampScroll(): void {
        if (this.zoom <= 1) this.scrollFraction = 0
    }
}
