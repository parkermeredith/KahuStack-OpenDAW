import {describe, expect, it} from "vitest"
import {RackStore} from "./rack-store"

describe("KBW rack store", () => {
    it("retains device order and bypass state per track", () => {
        const store = new RackStore()
        const first = store.addModule("track-01", "missing.module", "Unavailable module")
        const second = store.addModule("track-01", "utility.gain", "Gain", {gain_db: 0})
        store.setBypassed("track-01", first.id, true)
        store.move("track-01", second.id, -1)
        expect(store.devicesFor("track-01").map(device => device.id)).toEqual([second.id, first.id])
        expect(store.devicesFor("track-01")[1].bypassed).toBe(true)
        expect(store.devicesFor("track-02")).toHaveLength(0)
        expect(second.moduleId).toBe("utility.gain")
    })

    it("removes a track chain without affecting another track", () => {
        const store = new RackStore()
        store.addModule("track-01", "missing.module", "Unavailable module")
        store.addModule("track-02", "missing.module", "Unavailable module")
        store.removeTrack("track-01")
        expect(store.devicesFor("track-01")).toHaveLength(0)
        expect(store.devicesFor("track-02")).toHaveLength(1)
    })

    it("round-trips stable rack order and parameter state", () => {
        const store = new RackStore()
        const device = store.addModule("track-01", "utility.gain", "Gain", {gain_db: 3})
        store.setBypassed("track-01", device.id, true)
        const restored = new RackStore()
        restored.restore(store.serialize())
        expect(restored.devicesFor("track-01")[0]).toMatchObject({
            id: device.id,
            moduleId: "utility.gain",
            parameterValues: {gain_db: 3},
            bypassed: true
        })
    })

    it("recovers valid devices when one persisted device is malformed", () => {
        const store = new RackStore()
        const report = store.restoreRecoverable(JSON.stringify({
            version: 2,
            chains: [{trackId: "track-01", devices: [
                {id: "rack-01", name: "Gain", moduleId: "utility.gain", parameterValues: {gain_db: 0}, bypassed: false},
                {id: "rack-02", name: "Broken", moduleId: "utility.gain", parameterValues: {gain_db: "bad"}, bypassed: false},
            ]}],
        }))
        expect(report.restoredDevices).toBe(1)
        expect(report.skippedDevices).toBe(1)
        expect(store.devicesFor("track-01")).toHaveLength(1)
        expect(store.devicesFor("track-01")[0]?.id).toBe("rack-01")
    })
})
