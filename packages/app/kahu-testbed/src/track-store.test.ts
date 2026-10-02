import {describe, expect, it} from "vitest"
import {TrackStore} from "./track-store"

const audio = (name: string, durationSeconds: number) => ({
    name,
    durationSeconds,
    sampleRate: 48000,
    channelCount: 2,
    buffer: {} as AudioBuffer
})

describe("KBW track store", () => {
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

    it("applies solo, mute, gain, pan and duration rules", () => {
        const store = new TrackStore()
        const first = store.add(audio("Drums.wav", 4))
        const second = store.add(audio("Bass.wav", 6))
        store.setSolo(first.id, true)
        store.setGain(first.id, 0.4)
        store.setPan(first.id, -0.35)
        store.setMuted(second.id, true)
        expect(store.isAudible(first)).toBe(true)
        expect(store.isAudible(second)).toBe(false)
        expect(first.gain).toBe(0.4)
        expect(first.pan).toBe(-0.35)
        expect(store.durationSeconds()).toBe(6)
    })

    it("clamps pan edits and defaults new tracks to center", () => {
        const store = new TrackStore()
        const track = store.add(audio("Guitar.wav", 4))
        expect(track.pan).toBe(0)
        store.setPan(track.id, -2)
        expect(track.pan).toBe(-1)
        store.setPan(track.id, 2)
        expect(track.pan).toBe(1)
    })

    it("retains minimal timeline and source offsets", () => {
        const store = new TrackStore()
        const track = store.add(audio("Vocal.wav", 8))
        store.setRegionTiming(track.id, 3, 2)
        expect(track.region).toEqual({timelineStartSeconds: 3, sourceOffsetSeconds: 2, durationSeconds: 6})
        expect(store.durationSeconds()).toBe(9)
    })

    it("restores stable identity and clamps metadata to the decoded source", () => {
        const store = new TrackStore()
        const track = store.add(audio("Vocal.wav", 8), {
            id: "track-07",
            name: "Lead vocal",
            muted: true,
            solo: true,
            gain: 2,
            pan: -2,
            region: {timelineStartSeconds: 3, sourceOffsetSeconds: 7, durationSeconds: 9},
        })
        expect(track.id).toBe("track-07")
        expect(track.name).toBe("Lead vocal")
        expect(track.gain).toBe(1)
        expect(track.pan).toBe(-1)
        expect(track.region).toEqual({timelineStartSeconds: 3, sourceOffsetSeconds: 7, durationSeconds: 1})
        expect(store.add(audio("Second.wav", 1)).id).toBe("track-08")
    })
})
