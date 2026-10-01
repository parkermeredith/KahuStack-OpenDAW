import {describe, expect, it} from "vitest"
import {formatMusicalPosition, formatTimecode, Transport} from "./transport"

describe("KOD-2 transport", () => {
    it("formats time and musical positions", () => {
        expect(formatTimecode(65.25)).toBe("01:05:25")
        expect(formatMusicalPosition(2)).toBe("2.1")
    })

    it("advances while playing and freezes when paused", () => {
        let now = 0
        const transport = new Transport(() => now)
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
})
