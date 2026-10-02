// KUI-1 timeline authority: adapts the published openDAW TimelineRange to Kahu's seconds-based
// transport while keeping legacy viewport conversion only at the session migration boundary.

import {TimelineRange} from "@opendaw/studio-core"

export type LegacyViewportSnapshot = Readonly<{
    durationSeconds: number
    zoom: number
    scrollFraction: number
    visibleDurationSeconds: number
}>

export type PixelRegion = Readonly<{left: number, width: number}>

export class TimelineController {
    readonly range = new TimelineRange()

    private durationSeconds = 300

    constructor() {
        this.configureRange()
    }

    setDuration(durationSeconds: number): void {
        this.durationSeconds = Math.max(0.01, Number.isFinite(durationSeconds) ? durationSeconds : 0.01)
        this.configureRange()
    }

    setWidth(width: number): void {
        this.range.width = Math.max(0, Number.isFinite(width) ? width : 0)
    }

    setZoom(zoom: number): void {
        const safeZoom = Math.min(16, Math.max(1, Number.isFinite(zoom) ? zoom : 1))
        const visibleDuration = this.durationSeconds / safeZoom
        this.range.showUnitInterval(
            this.range.unitCenter - visibleDuration * 0.5,
            this.range.unitCenter + visibleDuration * 0.5,
        )
    }

    setScrollFraction(fraction: number): void {
        const visibleDuration = this.range.unitRange
        const safeFraction = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0))
        const available = Math.max(0, this.durationSeconds - visibleDuration)
        this.range.showUnitInterval(safeFraction * available, safeFraction * available + visibleDuration)
    }

    snapshot(): LegacyViewportSnapshot {
        const visibleDuration = this.range.unitRange
        const available = Math.max(0, this.durationSeconds - visibleDuration)
        return {
            durationSeconds: this.durationSeconds,
            zoom: Math.min(16, Math.max(1, this.durationSeconds / Math.max(0.01, visibleDuration))),
            scrollFraction: available <= 0 ? 0 : Math.min(1, Math.max(0, this.range.unitMin / available)),
            visibleDurationSeconds: visibleDuration,
        }
    }

    visibleStartSeconds(): number {return this.range.unitMin}
    visibleDurationSeconds(): number {return this.range.unitRange}

    secondsAtX(x: number, width: number): number {
        this.setWidth(width)
        return Math.min(this.durationSeconds, Math.max(0, this.range.xToUnit(x)))
    }

    regionStyle(startSeconds: number, durationSeconds: number): PixelRegion {
        const left = this.range.unitToX(Math.max(0, startSeconds))
        const right = this.range.unitToX(Math.max(0, startSeconds + Math.max(0, durationSeconds)))
        return {left, width: Math.max(0, right - left)}
    }

    positionX(seconds: number): number {
        return this.range.unitToX(Math.min(this.durationSeconds, Math.max(0, seconds)))
    }

    private configureRange(): void {
        this.range.maxUnits = this.durationSeconds
        this.range.minimum = 0.05
        if (this.range.unitRange > this.durationSeconds || this.range.unitMax <= 0) {
            this.range.showAll()
        }
    }
}
