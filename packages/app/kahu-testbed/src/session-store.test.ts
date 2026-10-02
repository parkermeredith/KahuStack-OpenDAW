// KUI-8 permanent session tests: normalized range plus transport-state round-trip, exact KBW v2 migration, and legacy
// v1 recovery remain isolated from browser-local source audio.

import {describe, expect, it} from "vitest"
import {decodeSession, encodeSession, type TestbedSession} from "./session-store"

describe("Kahu normalized session store", () => {
    it("round-trips recoverable metadata", () => {
        const session: TestbedSession = {
            version: 4,
            tracks: [{id: "track-01", name: "Drums", fileName: "drums.wav", durationSeconds: 4, sampleRate: 48000, channelCount: 2, muted: false, solo: true, gain: 0.8, region: {timelineStartSeconds: 1, sourceOffsetSeconds: 0.5, durationSeconds: 3.5}}],
            selectedTrackId: "track-01",
            viewport: {min: 0.1875, max: 0.6875},
            loop: {enabled: true, startSeconds: 1, endSeconds: 3.5},
            follow: true,
            rack: "{\"version\":1,\"chains\":[]}",
        }
        expect(decodeSession(encodeSession(session))).toEqual(session)
    })

    it("migrates version one metadata without source audio", () => {
        const session = decodeSession(JSON.stringify({
            version: 1,
            tracks: [{id: "track-01", name: "Drums", fileName: "drums.wav", durationSeconds: 4, sampleRate: 48000, channelCount: 2}],
            rack: "{}",
        }))
        expect(session.version).toBe(4)
        expect(session.tracks[0]?.region.durationSeconds).toBe(4)
        expect(session.viewport).toEqual({min: 0, max: 1})
    })

    it("migrates version two zoom and scroll exactly to normalized range", () => {
        const session = decodeSession(JSON.stringify({
            version: 2,
            tracks: [{id: "track-01", name: "Drums", fileName: "drums.wav", durationSeconds: 4, sampleRate: 48000, channelCount: 2, muted: false, solo: false, gain: 1, region: {timelineStartSeconds: 0, sourceOffsetSeconds: 0, durationSeconds: 4}}],
            rack: "{}",
            viewport: {zoom: 4, scrollFraction: 0.5},
        }))
        expect(session.version).toBe(4)
        expect(session.viewport.min).toBeCloseTo(0.375)
        expect(session.viewport.max).toBeCloseTo(0.625)
        expect(session.loop.enabled).false
        expect(session.follow).false
    })

    it("migrates version three viewport state without inventing transport state", () => {
        const session = decodeSession(JSON.stringify({
            version: 3,
            tracks: [{id: "track-01", name: "Drums", fileName: "drums.wav", durationSeconds: 4, sampleRate: 48000, channelCount: 2, muted: false, solo: false, gain: 1, region: {timelineStartSeconds: 0, sourceOffsetSeconds: 0, durationSeconds: 4}}],
            rack: "{}",
            viewport: {min: 0.25, max: 0.75},
        }))
        expect(session.version).toBe(4)
        expect(session.viewport).toEqual({min: 0.25, max: 0.75})
        expect(session.loop).toEqual({enabled: false, startSeconds: 0, endSeconds: 300})
        expect(session.follow).false
    })

    it("rejects unsupported or malformed session versions", () => {
        expect(() => decodeSession("{\"version\":5,\"tracks\":[],\"rack\":\"{}\"}")).toThrow("Invalid Kahu testbed session")
        expect(() => decodeSession("{\"version\":3,\"tracks\":[{}],\"rack\":\"{}\",\"viewport\":{}}"))
            .toThrow("Invalid Kahu testbed session")
        expect(() => decodeSession("{\"version\":2,\"tracks\":[],\"rack\":\"{}\",\"viewport\":{\"zoom\":2,\"scrollFraction\":2}}"))
            .toThrow("Invalid Kahu testbed session")
    })
})
