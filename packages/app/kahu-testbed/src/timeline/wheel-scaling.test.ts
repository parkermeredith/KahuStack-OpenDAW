// KUI-2 permanent wheel tests: preserve openDAW delta normalization, anchor clamping, and consumed
// gesture behavior across mouse-wheel and precision-trackpad input.

import {describe, expect, it} from "vitest"

if (!("AudioWorkletNode" in globalThis)) {
    Object.defineProperty(globalThis, "AudioWorkletNode", {value: class AudioWorkletNode {}})
}

const {TimelineRange} = await import("@opendaw/studio-core")
const {DeltaModeToPixels, apply, pixelsOf, scaleOf} = await import("./wheel-scaling")
const {attachWheelScroll} = await import("./wheel-scroll")

const event = (overrides: Partial<WheelEvent> = {}): WheelEvent => {
    const value = {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    clientX: 50,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault: () => {value.defaultPrevented = true},
    stopPropagation: () => {},
    ...overrides,
    } as WheelEvent
    return value
}

const range = (): InstanceType<typeof TimelineRange> => {
    const value = new TimelineRange()
    value.maxUnits = 100
    value.minimum = 0.05
    value.width = 1000
    return value
}

describe("Kahu OpenDAW wheel navigation", () => {
    it("converts all browser delta modes using the published factors", () => {
        expect(pixelsOf(event({deltaY: 2, deltaMode: 0}))).toBe(2 * DeltaModeToPixels[0])
        expect(pixelsOf(event({deltaY: 2, deltaMode: 1}))).toBe(2 * DeltaModeToPixels[1])
        expect(pixelsOf(event({deltaY: 2, deltaMode: 2}))).toBe(2 * DeltaModeToPixels[2])
        expect(pixelsOf(event({deltaY: 0}))).toBe(0)
        expect(scaleOf(event({deltaY: 0}))).toBe(0)
        expect(scaleOf(event({deltaY: 0.5}))).toBeGreaterThan(0)
        expect(scaleOf(event({deltaY: 0.5}))).toBeLessThan(0.1)
    })

    it("keeps zoom finite and anchored when the pointer is outside the element", () => {
        const value = range()
        const element = {getBoundingClientRect: () => ({left: 0, width: 1000})} as Element
        apply(element, value, event({deltaY: -20, clientX: 2000}))
        expect(Number.isFinite(value.unitMin)).true
        expect(Number.isFinite(value.unitMax)).true
        expect(value.unitMin).toBeGreaterThanOrEqual(0)
        expect(value.unitMax).toBeLessThanOrEqual(100)
    })

    it("uses the shared range for shift zoom and horizontal pan", () => {
        const value = range()
        let listener: ((event: Event) => void) | undefined
        const element = {
            addEventListener: (_type: string, next: EventListenerOrEventListenerObject) => {
                listener = next as (event: Event) => void
            },
            removeEventListener: () => {},
            getBoundingClientRect: () => ({left: 0, width: 1000}),
        } as unknown as Element
        const initialLength = value.unitRange
        const cleanup = attachWheelScroll(element, value)
        const zoom = event({deltaY: -30, clientX: 250, shiftKey: true})
        listener?.(zoom)
        expect(value.unitRange).toBeLessThan(initialLength)
        expect(zoom.defaultPrevented).true
        const beforePan = value.unitMin
        const pan = event({deltaX: 120})
        listener?.(pan)
        expect(value.unitMin).not.toBe(beforePan)
        expect(pan.defaultPrevented).true
        const beforeAltPan = value.unitMin
        const altPan = event({deltaY: 12, altKey: true})
        listener?.(altPan)
        expect(value.unitMin).not.toBe(beforeAltPan)
        expect(altPan.defaultPrevented).true
        const vertical = event({deltaY: 12})
        listener?.(vertical)
        expect(vertical.defaultPrevented).false
        cleanup()
    })
})
