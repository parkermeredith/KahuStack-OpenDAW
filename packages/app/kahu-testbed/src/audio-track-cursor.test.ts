import {describe, expect, it} from "vitest"
import {playbackEndOffsetSeconds, playbackPositionSeconds} from "./audio-track"

describe("KBW-18 playback cursor", () => {
    it("adds elapsed context time to a non-zero source offset", () => {
        expect(playbackPositionSeconds(12, 20, 20, 30)).toBe(12)
        expect(playbackPositionSeconds(12, 20, 23.5, 30)).toBe(15.5)
    })

    it("holds the source offset before a future scheduled start", () => {
        expect(playbackPositionSeconds(8, 12, 10, 20)).toBe(8)
    })

    it("clamps a running cursor to the scheduled source end", () => {
        expect(playbackPositionSeconds(8, 10, 30, 11.5)).toBe(11.5)
    })

    it("computes bounded and play-to-end completion offsets", () => {
        expect(playbackEndOffsetSeconds(30, 8, 3.5)).toBe(11.5)
        expect(playbackEndOffsetSeconds(30, 28, 8)).toBe(30)
        expect(playbackEndOffsetSeconds(30, 8)).toBe(30)
        expect(playbackEndOffsetSeconds(30, 8, 0)).toBe(30)
    })

    it("contains non-finite cursor inputs", () => {
        expect(playbackEndOffsetSeconds(Number.NaN, Number.POSITIVE_INFINITY, 4)).toBe(0)
        expect(playbackPositionSeconds(4, Number.NaN, 8, 10)).toBe(4)
    })
})
