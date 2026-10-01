import {describe, expect, it} from "vitest"
import {TrackStore} from "./track-store"

const audio = (name: string, durationSeconds: number) => ({
    name,
    durationSeconds,
    sampleRate: 48000,
    channelCount: 2,
    buffer: {} as AudioBuffer
})

describe("KBW-4 track store", () => {
    it("assigns stable IDs and retains selection", () => {
        const store = new TrackStore()
        const first = store.add(audio("Drums.wav", 4))
        const second = store.add(audio("Bass.wav", 6))
        expect(first.id).toBe("track-01")
        expect(second.id).toBe("track-02")
        expect(store.selected()?.id).toBe("track-02")
        store.select(first.id)
        expect(store.selected()?.name).toBe("Drums.wav")
    })

    it("applies solo, mute, gain and duration rules", () => {
        const store = new TrackStore()
        const first = store.add(audio("Drums.wav", 4))
        const second = store.add(audio("Bass.wav", 6))
        store.setSolo(first.id, true)
        store.setGain(first.id, 0.4)
        store.setMuted(second.id, true)
        expect(store.isAudible(first)).toBe(true)
        expect(store.isAudible(second)).toBe(false)
        expect(first.gain).toBe(0.4)
        expect(store.durationSeconds()).toBe(6)
    })

    it("retains minimal timeline and source offsets", () => {
        const store = new TrackStore()
        const track = store.add(audio("Vocal.wav", 8))
        store.setRegionTiming(track.id, 3, 2)
        expect(track.region).toEqual({timelineStartSeconds: 3, sourceOffsetSeconds: 2, durationSeconds: 6})
        expect(store.durationSeconds()).toBe(9)
    })
})
