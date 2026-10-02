// KUI-7 region interaction authority: moves one audio region by TimelineRange time conversion,
// preserves source offset, clamps timeline start at zero, and restores the original position on cancel.

import {TimelineRange} from "@opendaw/studio-core"
import type {AudioRegion} from "../region"

export class RegionDragSession {
    readonly originalStartSeconds: number
    private committed = false

    constructor(
        private readonly range: TimelineRange,
        private readonly region: AudioRegion,
        pointerX: number,
    ) {
        this.originalStartSeconds = Math.max(0, region.timelineStartSeconds)
        this.pointerTimeSeconds = range.xToUnit(pointerX)
    }

    private readonly pointerTimeSeconds: number

    update(pointerX: number): number {
        if (this.committed) return this.region.timelineStartSeconds
        const delta = this.range.xToUnit(pointerX) - this.pointerTimeSeconds
        this.region.timelineStartSeconds = Math.max(0, this.originalStartSeconds + delta)
        return this.region.timelineStartSeconds
    }

    approve(): number {
        this.committed = true
        return this.region.timelineStartSeconds
    }

    cancel(): void {
        if (!this.committed) this.region.timelineStartSeconds = this.originalStartSeconds
    }
}

export const moveRangeForEdgePointer = (
    range: TimelineRange,
    clientX: number,
    viewport: Readonly<{left: number, right: number}>,
    padding = 32,
): boolean => {
    const safePadding = Math.max(1, padding)
    if (clientX < viewport.left + safePadding) {
        const ratio = (viewport.left + safePadding - clientX) / safePadding
        range.moveUnitBy(-range.unitsPerPixel * Math.max(0.25, ratio))
        return true
    }
    if (clientX > viewport.right - safePadding) {
        const ratio = (clientX - (viewport.right - safePadding)) / safePadding
        range.moveUnitBy(range.unitsPerPixel * Math.max(0.25, ratio))
        return true
    }
    return false
}
