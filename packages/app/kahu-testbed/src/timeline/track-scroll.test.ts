// KUI-6 permanent scroll tests: header and lane scroll positions are mirrored without recursive
// event storms, and disposal removes the synchronization contract.

import {describe, expect, it} from "vitest"
import {TrackScrollModel} from "./track-scroll"

type FakeElement = HTMLElement & {emit: () => void}

const fakeElement = (): FakeElement => {
    const listeners = new Set<() => void>()
    const value = {
        scrollTop: 0,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.add(listener as () => void)
        },
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
            listeners.delete(listener as () => void)
        },
        emit: () => listeners.forEach(listener => listener()),
    }
    return value as unknown as FakeElement
}

describe("Kahu fixed track scroll", () => {
    it("mirrors header and lane scroll positions", () => {
        const headers = fakeElement()
        const lanes = fakeElement()
        const model = new TrackScrollModel(headers, lanes)
        headers.scrollTop = 120
        headers.emit()
        expect(lanes.scrollTop).toBe(120)
        lanes.scrollTop = 240
        lanes.emit()
        expect(headers.scrollTop).toBe(240)
        model.dispose()
    })

    it("does not continue syncing after disposal", () => {
        const headers = fakeElement()
        const lanes = fakeElement()
        const model = new TrackScrollModel(headers, lanes)
        model.dispose()
        headers.scrollTop = 120
        headers.emit()
        expect(lanes.scrollTop).toBe(0)
    })
})
