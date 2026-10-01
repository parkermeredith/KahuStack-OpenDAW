import {describe, expect, it} from "vitest"
import {formatMusicalPosition, formatTimecode, Transport} from "./transport"

describe("KBW-3 transport", () => {
    it("formats time and musical positions", () => {
        expect(formatTimecode(65.25)).toBe("01:05:25")
        expect(formatMusicalPosition(2)).toBe("2.1")
    })

    it("advances while playing and freezes when paused", () => {
        let now = 0
        const transport = new Transport(() => now, undefined, 0)
        transport.play()
        now = 1.25
        expect(transport.snapshot().timecode).toBe("00:01:25")
        transport.pause()
        now = 3
        expect(transport.snapshot().timecode).toBe("00:01:25")
    })

    it("clamps seeks and stop returns to the start", () => {
        const transport = new Transport(() => 0, 10)
        transport.seek(-5)
        expect(transport.snapshot().positionSeconds).toBe(0)
        transport.seek(20)
        expect(transport.snapshot().positionSeconds).toBe(10)
        transport.stop()
        expect(transport.snapshot().positionSeconds).toBe(0)
    })

    it("returns one bounded audio-clock epoch for synchronized starts and seeks", () => {
        let now = 10
        const transport = new Transport(() => now, 20, 0.025)
        const start = transport.play()
        expect(start).toEqual({startTimeSeconds: 10.025, positionSeconds: 0})
        now = 11
        expect(transport.snapshot().positionSeconds).toBeCloseTo(0.975)
        const seek = transport.seek(4)
        expect(seek).toEqual({startTimeSeconds: 11.025, positionSeconds: 4})
        now = 12
        expect(transport.snapshot().positionSeconds).toBeCloseTo(4.975)
    })
})
