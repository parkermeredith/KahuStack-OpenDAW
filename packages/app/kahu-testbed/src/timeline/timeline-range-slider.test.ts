// KUI-4 permanent navigator tests: verify handle isolation, center panning, recenter clicks, reset,
// and finite behavior through the published TimelineRange mutators.

import {describe, expect, it} from "vitest"

if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {TimelineRange} = await import("@opendaw/studio-core")
const {modifyRangeSliderPart, recenterRangeSlider, showAllFromRangeSlider} = await import("./timeline-range-slider")

const range = () => {
    const value = new TimelineRange()
    value.maxUnits = 10
    value.minimum = 0.05
    value.width = 1000
    value.min = 0.2
    value.max = 0.6
    return value
}

describe("Kahu timeline range navigator", () => {
    it("edits only the selected handle", () => {
        const value = range()
        modifyRangeSliderPart(value, "min", 0.1)
        expect(value.min).toBeCloseTo(0.1)
        expect(value.max).toBeCloseTo(0.6)
        modifyRangeSliderPart(value, "max", 0.8)
        expect(value.min).toBeCloseTo(0.1)
        expect(value.max).toBeCloseTo(0.8)
    })

    it("pans the center without changing visible length and recenters clicks", () => {
        const value = range()
        const length = value.length
        modifyRangeSliderPart(value, "center", 0.8)
        expect(value.length).toBeCloseTo(length)
        expect(value.center).toBeCloseTo(0.8)
        recenterRangeSlider(value, 0.25)
        expect(value.center).toBeCloseTo(0.25)
    })

    it("shows all and stays finite at a collapsed layout", () => {
        const value = range()
        value.width = 0
        showAllFromRangeSlider(value)
        expect(value.min).toBe(0)
        expect(value.max).toBe(1)
        expect(Number.isFinite(value.unitsPerPixel)).true
    })
})
