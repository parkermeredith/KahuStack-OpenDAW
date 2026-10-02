import {describe, expect, it} from "vitest"
import type {DecodedAudioFile} from "./audio-track"
import type {SessionTrack} from "./session-store"
import {findRecoverableSessionTrack, matchesRecoverableSource} from "./source-recovery"

const sessionTrack = (overrides: Partial<SessionTrack> = {}): SessionTrack => ({
    id: "track-01",
    name: "Lead vocal",
    fileName: "Dennis Lead.wav",
    durationSeconds: 12.5,
    sampleRate: 48000,
    channelCount: 2,
    muted: false,
    solo: false,
    gain: 1,
    pan: 0,
    region: {timelineStartSeconds: 0, sourceOffsetSeconds: 0, durationSeconds: 12.5},
    ...overrides,
})

const source = (overrides: Partial<DecodedAudioFile> = {}): DecodedAudioFile => ({
    name: "dennis lead.wav",
    durationSeconds: 12.5,
    sampleRate: 44100,
    channelCount: 2,
    buffer: {} as AudioBuffer,
    ...overrides,
})

describe("KBW-17 source recovery identity", () => {
    it("matches filename case, channel count and decoded duration without requiring the same context sample rate", () => {
        expect(matchesRecoverableSource(sessionTrack(), source())).toBe(true)
        expect(matchesRecoverableSource(sessionTrack(), source({durationSeconds: 12.54}))).toBe(true)
    })

    it("rejects wrong-channel and materially different sources with the same filename", () => {
        expect(matchesRecoverableSource(sessionTrack(), source({channelCount: 1}))).toBe(false)
        expect(matchesRecoverableSource(sessionTrack(), source({durationSeconds: 12.6}))).toBe(false)
    })

    it("selects the first matching unrecovered session track", () => {
        const first = sessionTrack()
        const second = sessionTrack({id: "track-02", name: "Lead vocal copy"})
        expect(findRecoverableSessionTrack([first, second], new Set(), source())?.id).toBe("track-01")
        expect(findRecoverableSessionTrack([first, second], new Set([first.id]), source())?.id).toBe("track-02")
        expect(findRecoverableSessionTrack([first, second], new Set([first.id, second.id]), source())).toBeUndefined()
    })
})
