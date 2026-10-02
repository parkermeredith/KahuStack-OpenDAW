import {describe, expect, it} from "vitest"
import {decodeSession, encodeSession, type TestbedSession} from "./session-store"

describe("KBW-12 session store", () => {
    it("round-trips recoverable metadata", () => {
        const session: TestbedSession = {
            version: 2,
            tracks: [{id: "track-01", name: "Drums", fileName: "drums.wav", durationSeconds: 4, sampleRate: 48000, channelCount: 2, muted: false, solo: true, gain: 0.8, region: {timelineStartSeconds: 1, sourceOffsetSeconds: 0.5, durationSeconds: 3.5}}],
            selectedTrackId: "track-01",
            viewport: {zoom: 2, scrollFraction: 0.25},
            rack: "{\"version\":1,\"chains\":[]}"
        }
        expect(decodeSession(encodeSession(session))).toEqual(session)
    })

    it("migrates version one metadata without source audio", () => {
        const session = decodeSession("{\"version\":1,\"tracks\":[{\"id\":\"track-01\",\"name\":\"Drums\",\"fileName\":\"drums.wav\",\"durationSeconds\":4,\"sampleRate\":48000,\"channelCount\":2}],\"rack\":\"{\\\"version\\\":1,\\\"chains\\\":[]}\"}")
        expect(session.version).toBe(2)
        expect(session.tracks[0]?.region.durationSeconds).toBe(4)
        expect(session.viewport.zoom).toBe(1)
    })

    it("rejects unsupported or malformed session versions", () => {
        expect(() => decodeSession("{\"version\":3,\"tracks\":[],\"rack\":\"{}\"}")).toThrow("Invalid Kahu testbed session")
        expect(() => decodeSession("{\"version\":2,\"tracks\":[{}],\"rack\":\"{}\",\"viewport\":{}}"))
            .toThrow("Invalid Kahu testbed session")
        expect(() => decodeSession("{\"version\":2,\"tracks\":[],\"rack\":\"{}\",\"viewport\":{\"zoom\":2,\"scrollFraction\":2}}"))
            .toThrow("Invalid Kahu testbed session")
    })
})
