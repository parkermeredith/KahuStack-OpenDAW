// KUI-7 permanent region tests: direct movement, zero clamp, cancel restore, source-offset
// preservation, and edge auto-scroll are covered without requiring browser pointer dispatch.

import {describe, expect, it} from "vitest"
import {createAudioRegion} from "../region"

if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {TimelineRange} = await import("@opendaw/studio-core")
const {RegionDragSession, moveRangeForEdgePointer} = await import("./region-drag")

const makeRange = () => {
    const range = new TimelineRange()
    range.maxUnits = 10
    range.minimum = 0.05
    range.width = 1000
    return range
}

describe("Kahu direct region drag", () => {
    it("moves right and preserves source offset", () => {
        const range = makeRange()
        const region = createAudioRegion(4)
        region.sourceOffsetSeconds = 0.75
        const session = new RegionDragSession(range, region, 100)
        session.update(300)
        expect(region.timelineStartSeconds).toBeCloseTo(2)
        expect(region.sourceOffsetSeconds).toBe(0.75)
        session.approve()
    })

    it("clamps left movement at zero and cancel restores the original", () => {
        const range = makeRange()
        const region = createAudioRegion(4)
        region.timelineStartSeconds = 2
        const session = new RegionDragSession(range, region, 500)
        session.update(-500)
        expect(region.timelineStartSeconds).toBe(0)
        session.cancel()
        expect(region.timelineStartSeconds).toBe(2)
    })

    it("pans the shared range while the pointer is at an edge", () => {
        const range = makeRange()
        range.showUnitInterval(2, 4)
        const before = range.unitMin
        expect(moveRangeForEdgePointer(range, 1, {left: 0, right: 100}, 24)).true
        expect(range.unitMin).toBeLessThan(before)
        expect(moveRangeForEdgePointer(range, 50, {left: 0, right: 100}, 24)).false
    })
})
