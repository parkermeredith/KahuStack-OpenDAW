// KBW-4 permanent tests: region timing must wait, offset, and remain silent at the correct boundaries.

import {describe, expect, it} from "vitest"
import {planRegionPlayback, type AudioRegion} from "./region"

const region: AudioRegion = {timelineStartSeconds: 5, sourceOffsetSeconds: 2, durationSeconds: 4}

describe("KBW-4 minimal audio regions", () => {
    it("waits before the timeline entrance", () => {
        expect(planRegionPlayback(region, 3, 10)).toEqual({
            delaySeconds: 2,
            sourceOffsetSeconds: 2,
            durationSeconds: 4,
        })
    })

    it("advances the source offset inside an active region", () => {
        expect(planRegionPlayback(region, 6.5, 10)).toEqual({
            delaySeconds: 0,
            sourceOffsetSeconds: 3.5,
            durationSeconds: 2.5,
        })
    })

    it("stays silent before and after the admitted region", () => {
        expect(planRegionPlayback(region, 5, 10)).not.toBeUndefined()
        expect(planRegionPlayback(region, 9, 10)).toBeUndefined()
        expect(planRegionPlayback(region, 4.9, 2)).toBeUndefined()
    })
})
