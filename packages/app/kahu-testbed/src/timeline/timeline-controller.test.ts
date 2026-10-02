// KUI-1 permanent range-authority tests: prove seconds mapping remains finite and session-boundary
// legacy viewport conversion does not create a second UI viewport implementation.

import {describe, expect, it} from "vitest"

// studio-core exports browser engine classes from its package barrel. The range itself is pure,
// so provide the browser base class before importing the barrel in the Node-focused test process.
if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {TimelineController} = await import("./timeline-controller")

describe("TimelineController", () => {
    it("uses TimelineRange as the seconds-based viewport authority", () => {
        const controller = new TimelineController()
        controller.setDuration(10)
        controller.setWidth(1000)
        controller.setZoom(2)
        expect(controller.range.unitRange).toBeCloseTo(5)
        expect(controller.range.unitToX(controller.range.unitMin)).toBeCloseTo(0)
        expect(controller.range.unitToX(controller.range.unitMax)).toBeCloseTo(1000)
        expect(controller.secondsAtX(250, 1000)).toBeCloseTo(controller.range.unitMin + 1.25)
    })

    it("keeps range transforms finite when layout width is zero", () => {
        const controller = new TimelineController()
        controller.setDuration(30)
        controller.setWidth(0)
        controller.range.scaleUnitBy(-0.1, 15)
        expect(Number.isFinite(controller.range.unitMin)).true
        expect(Number.isFinite(controller.range.unitMax)).true
    })

    it("restores a legacy zoom/scroll snapshot through the range", () => {
        const controller = new TimelineController()
        controller.setDuration(20)
        controller.setZoom(4)
        controller.setScrollFraction(0.5)
        const snapshot = controller.snapshot()
        expect(snapshot.zoom).toBeCloseTo(4)
        expect(snapshot.scrollFraction).toBeCloseTo(0.5)
    })
})
