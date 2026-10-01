import {describe, expect, it} from "vitest"
import {computeWaveformPeaks} from "./waveform"

describe("KOD-3 waveform analysis", () => {
    it("reduces source samples into bounded columns", () => {
        const peaks = computeWaveformPeaks(new Float32Array([-1, -0.25, 0.5, 0.25, 1]), 2)
        expect(Array.from(peaks.minimum)).toEqual([-1, 0])
        expect(Array.from(peaks.maximum)).toEqual([0, 1])
    })
})
