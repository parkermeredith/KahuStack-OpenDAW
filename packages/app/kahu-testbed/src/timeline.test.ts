// KBW-6 permanent tests: viewport math must remain bounded and deterministic across zoom/scroll.

import {describe, expect, it} from "vitest"
import {TimelineViewport} from "./timeline"

describe("KBW-6 timeline viewport", () => {
    it("maps click positions through a zoomed and scrolled viewport", () => {
        const viewport = new TimelineViewport()
        viewport.setDuration(100)
        viewport.setZoom(4)
        viewport.setScrollFraction(0.5)
        expect(viewport.snapshot().visibleDurationSeconds).toBe(25)
        expect(viewport.secondsAtX(0, 1000)).toBe(37.5)
        expect(viewport.secondsAtX(1000, 1000)).toBe(62.5)
    })

    it("keeps zoom and scroll within admitted bounds", () => {
        const viewport = new TimelineViewport()
        viewport.setDuration(10)
        viewport.setZoom(99)
        viewport.setScrollFraction(-1)
        expect(viewport.snapshot().zoom).toBe(8)
        expect(viewport.snapshot().scrollFraction).toBe(0)
        viewport.setScrollFraction(99)
        expect(viewport.snapshot().scrollFraction).toBe(1)
    })

    it("returns region layout percentages relative to the visible range", () => {
        const viewport = new TimelineViewport()
        viewport.setDuration(100)
        viewport.setZoom(2)
        viewport.setScrollFraction(0.25)
        expect(viewport.regionStyle(25, 10)).toEqual({leftPercent: 25, widthPercent: 10})
    })
})
