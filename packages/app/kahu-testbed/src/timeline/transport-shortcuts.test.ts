// KUI-8 permanent shortcut tests: exact key mappings work outside editable controls and remain
// suppressed for text, number, and select inputs.

import {describe, expect, it, vi} from "vitest"
import {dispatchTransportShortcut} from "./transport-shortcuts"

if (!("HTMLElement" in globalThis)) {
    class TestHTMLElement {}
    class TestHTMLInputElement extends TestHTMLElement {}
    Object.assign(globalThis, {HTMLElement: TestHTMLElement, HTMLInputElement: TestHTMLInputElement})
}

const actions = () => ({
    togglePlayback: vi.fn(),
    stop: vi.fn(),
    movePosition: vi.fn(),
    toggleLoop: vi.fn(),
    toggleFollow: vi.fn(),
})

describe("Kahu transport shortcuts", () => {
    it("dispatches Space, Period, arrows, and shifted toggles", () => {
        const value = actions()
        const preventDefault = vi.fn()
        for (const event of [
            {key: " ", code: "Space", shiftKey: false},
            {key: ".", code: "Period", shiftKey: false},
            {key: "ArrowLeft", code: "ArrowLeft", shiftKey: false},
            {key: "ArrowRight", code: "ArrowRight", shiftKey: false},
            {key: "l", code: "KeyL", shiftKey: true},
            {key: "f", code: "KeyF", shiftKey: true},
        ]) {
            expect(dispatchTransportShortcut({...event, preventDefault, target: null}, value)).true
        }
        expect(value.togglePlayback).toHaveBeenCalledOnce()
        expect(value.stop).toHaveBeenCalledOnce()
        expect(value.movePosition).toHaveBeenNthCalledWith(1, -1)
        expect(value.movePosition).toHaveBeenNthCalledWith(2, 1)
        expect(value.toggleLoop).toHaveBeenCalledOnce()
        expect(value.toggleFollow).toHaveBeenCalledOnce()
        expect(preventDefault).toHaveBeenCalledTimes(6)
    })

    it("does not consume shortcuts from editable controls", () => {
        const value = actions()
        const input = Object.create(HTMLInputElement.prototype) as HTMLInputElement
        expect(dispatchTransportShortcut({key: " ", code: "Space", shiftKey: false, preventDefault: vi.fn(), target: input}, value)).false
        expect(value.togglePlayback).not.toHaveBeenCalled()
    })
})
