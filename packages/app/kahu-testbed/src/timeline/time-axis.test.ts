// KUI-3 permanent ruler tests: keep adaptive tick selection, seconds labels, and range geometry
// deterministic independently of the browser canvas.

import {describe, expect, it} from "vitest"

if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {formatTimeAxisLabel, selectTickInterval} = await import("./time-axis")

describe("Kahu seconds time axis", () => {
    it("selects the first interval that meets the 80-pixel target", () => {
        expect(selectTickInterval(8, 800)).toBe(1)
        expect(selectTickInterval(0.8, 800)).toBe(0.1)
        expect(selectTickInterval(100000, 800)).toBe(600)
    })

    it("formats subsecond, minute, and hour labels by interval", () => {
        expect(formatTimeAxisLabel(65.23, 0.5)).toBe("1:05.23")
        expect(formatTimeAxisLabel(65.23, 1)).toBe("1:05")
        expect(formatTimeAxisLabel(3665, 60)).toBe("1:01:05")
        expect(formatTimeAxisLabel(65, 60)).toBe("1:05")
    })
})
