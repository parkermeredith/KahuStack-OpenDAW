import {describe, expect, it} from "vitest"
import {effectiveBypass} from "./bypass-policy"

describe("Kahu rack bypass policy", () => {
    it("preserves local bypass while global bypass is off", () => {
        expect(effectiveBypass(false, false)).toBe(false)
        expect(effectiveBypass(false, true)).toBe(true)
    })

    it("keeps every device bypassed while global bypass is active", () => {
        expect(effectiveBypass(true, false)).toBe(true)
        expect(effectiveBypass(true, true)).toBe(true)
    })
})
