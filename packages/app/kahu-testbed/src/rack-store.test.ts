import {describe, expect, it} from "vitest"
import {RackStore} from "./rack-store"

describe("KOD-5 rack store", () => {
    it("retains device order and bypass state per track", () => {
        const store = new RackStore()
        const first = store.addReferenceSlot("track-01")
        const second = store.addReferenceSlot("track-01")
        store.setBypassed("track-01", first.id, true)
        store.move("track-01", second.id, -1)
        expect(store.devicesFor("track-01").map(device => device.id)).toEqual([second.id, first.id])
        expect(store.devicesFor("track-01")[1].bypassed).toBe(true)
        expect(store.devicesFor("track-02")).toHaveLength(0)
    })

    it("removes a track chain without affecting another track", () => {
        const store = new RackStore()
        store.addReferenceSlot("track-01")
        store.addReferenceSlot("track-02")
        store.removeTrack("track-01")
        expect(store.devicesFor("track-01")).toHaveLength(0)
        expect(store.devicesFor("track-02")).toHaveLength(1)
    })
})
