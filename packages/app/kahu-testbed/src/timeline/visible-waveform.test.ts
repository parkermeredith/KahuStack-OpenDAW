// KUI-5 permanent alignment matrix: ruler, region geometry, waveform source extraction, and
// playhead transforms must remain based on the same visible TimelineRange interval.

import {describe, expect, it} from "vitest"
import {createAudioRegion} from "../region"

if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {TimelineRange} = await import("@opendaw/studio-core")
const {projectRegionPixels, projectVisibleWaveform} = await import("./visible-waveform")

const makeRange = (min: number, max: number) => {
    const range = new TimelineRange()
    range.maxUnits = 10
    range.minimum = 0.05
    range.width = 1000
    range.showUnitInterval(min, max)
    return range
}

describe("Kahu waveform/range alignment", () => {
    it.each([
        {name: "show all", range: [0, 10], region: [0, 10], offset: 0, expected: [0, 10], pixels: [0, 1000]},
        {name: "zoom around center", range: [2, 4], region: [0, 10], offset: 0, expected: [2, 4], pixels: [0, 1000]},
        {name: "pan left", range: [1, 3], region: [0, 10], offset: 0, expected: [1, 3], pixels: [0, 1000]},
        {name: "pan right", range: [7, 9], region: [0, 10], offset: 0, expected: [7, 9], pixels: [0, 1000]},
        {name: "region begins before viewport", range: [2, 4], region: [0, 3], offset: 0, expected: [2, 3], pixels: [0, 500]},
        {name: "region begins inside viewport", range: [2, 4], region: [3, 7], offset: 0, expected: [3, 4], pixels: [500, 1000]},
        {name: "region ends inside viewport", range: [2, 4], region: [0, 3], offset: 0, expected: [2, 3], pixels: [0, 500]},
        {name: "region spans complete viewport", range: [2, 4], region: [0, 10], offset: 0, expected: [2, 4], pixels: [0, 1000]},
        {name: "source offset", range: [2, 4], region: [0, 10], offset: 2, expected: [2, 4], pixels: [0, 1000]},
    ])("uses one interval for $name", ({range: rangeBounds, region: regionBounds, offset, expected, pixels}) => {
        const range = makeRange(rangeBounds[0], rangeBounds[1])
        const region = createAudioRegion(8)
        region.timelineStartSeconds = regionBounds[0]
        region.sourceOffsetSeconds = offset
        region.durationSeconds = regionBounds[1] - regionBounds[0]
        const projection = projectVisibleWaveform(range, region, 100)
        expect(projection).toBeDefined()
        expect(projection?.timelineStartSeconds).toBeCloseTo(expected[0])
        expect(projection?.timelineEndSeconds).toBeCloseTo(expected[1])
        expect(projection?.sourceStartSamples).toBeCloseTo(offset * 100 + (expected[0] - regionBounds[0]) * 100)
        expect(projection?.sourceEndSamples).toBeCloseTo(offset * 100 + (expected[1] - regionBounds[0]) * 100)
        expect(projection?.leftPixels).toBeCloseTo(pixels[0])
        expect(projection?.rightPixels).toBeCloseTo(pixels[1])
        expect(projectRegionPixels(range, rangeBounds[0], rangeBounds[1] - rangeBounds[0]).rightPixels)
            .toBeCloseTo(range.unitToX(rangeBounds[1]))
    })
})
