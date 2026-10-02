// KUI-8 permanent follow tests: follow is opt-in, pages by exactly one visible range length, and
// region dragging suppresses automatic range movement.

import {describe, expect, it} from "vitest"

if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {TimelineRange} = await import("@opendaw/studio-core")
const {TimelineFollowController} = await import("./timeline-controller")

const makeRange = () => {
    const range = new TimelineRange()
    range.maxUnits = 10
    range.minimum = 0.05
    range.width = 1000
    range.showUnitInterval(2, 4)
    return range
}

describe("Kahu follow playhead", () => {
    it("is off by default and pages right by one visible interval", () => {
        const range = makeRange()
        const follow = new TimelineFollowController(range)
        follow.update(5, false)
        expect(range.unitMin).toBe(2)
        follow.setEnabled(true, 3)
        follow.update(4.1, false)
        expect(range.unitMin).toBeCloseTo(4)
        expect(range.unitMax).toBeCloseTo(6)
    })

    it("pages left by one interval and pauses while dragging", () => {
        const range = makeRange()
        const follow = new TimelineFollowController(range)
        follow.setEnabled(true, 3)
        follow.update(1.9, false)
        expect(range.unitMin).toBeCloseTo(0)
        expect(range.unitMax).toBeCloseTo(2)
        range.showUnitInterval(2, 4)
        follow.setEnabled(true, 3)
        follow.update(5, true)
        expect(range.unitMin).toBe(2)
        expect(range.unitMax).toBe(4)
    })
})
