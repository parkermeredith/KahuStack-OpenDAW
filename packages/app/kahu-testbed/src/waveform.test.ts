import {describe, expect, it} from "vitest"
import {buildWaveformPyramid, chooseWaveformLevel, computeWaveformPeaks, extractVisibleWaveformPeaks} from "./waveform"

describe("KBW-5 multiresolution waveform analysis", () => {
    it("retains multiple min/max levels and extracts bounded columns", () => {
        const peaks = computeWaveformPeaks(new Float32Array([-1, -0.25, 0.5, 0.25, 1]), 2)
        expect(Array.from(peaks.minimum)).toEqual([-1, 0])
        expect(Array.from(peaks.maximum)).toEqual([0.5, 1])

        const pyramid = buildWaveformPyramid(new Float32Array([-1, -0.25, 0.5, 0.25, 1]), 2)
        expect(pyramid.levels.map(level => level.samplesPerPeak)).toEqual([2, 4, 8])
        expect(chooseWaveformLevel(pyramid, 4).samplesPerPeak).toBe(4)
        const visible = extractVisibleWaveformPeaks(pyramid, 1, 5, 2)
        expect(visible.minimum).toHaveLength(2)
        expect(visible.maximum).toHaveLength(2)
    })

    it("keeps draw input bounded by viewport width", () => {
        const samples = Float32Array.from({length: 4096}, (_, index) => Math.sin(index / 9))
        const pyramid = buildWaveformPyramid(samples)
        const visible = extractVisibleWaveformPeaks(pyramid, 512, 3584, 64)
        expect(visible.minimum.length).toBe(64)
        expect(visible.maximum.length).toBe(64)
    })
})
