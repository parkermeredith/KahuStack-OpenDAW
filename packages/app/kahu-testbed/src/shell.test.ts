import {describe, expect, it} from "vitest"
import {TestbedShell} from "./shell"

describe("KahuStack testbed shell", () => {
    it("exposes the KOD-1 identity and engine status", () => {
        expect(TestbedShell.title).toBe("KahuStack DSP Testbed")
        expect(TestbedShell.phase).toBe("KOD-1 / UI SHELL")
        expect(TestbedShell.engineStatus).toContain("RUST/WASM ENGINE")
    })
})
