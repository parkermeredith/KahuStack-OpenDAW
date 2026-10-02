import {describe, expect, it} from "vitest"
import {TestbedShell} from "./shell"

describe("KahuStack testbed shell", () => {
    it("exposes the KUX workbench identity and engine status", () => {
        expect(TestbedShell.title).toBe("KahuStack DSP Testbed")
        expect(TestbedShell.phase).toBe("KUX / BROWSER WORKBENCH")
        expect(TestbedShell.engineStatus).toContain("RUST/WASM ENGINE")
    })
})
