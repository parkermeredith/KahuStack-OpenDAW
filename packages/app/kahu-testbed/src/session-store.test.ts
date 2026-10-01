import {describe, expect, it} from "vitest"
import {decodeSession, encodeSession, type TestbedSession} from "./session-store"

describe("KOD-9 session store", () => {
    it("round-trips recoverable metadata", () => {
        const session: TestbedSession = {
            version: 1,
            tracks: [{id: "track-01", name: "Drums", fileName: "drums.wav", durationSeconds: 4, sampleRate: 48000, channelCount: 2}],
            rack: "{\"version\":1,\"chains\":[]}"
        }
        expect(decodeSession(encodeSession(session))).toEqual(session)
    })

    it("rejects unsupported session versions", () => {
        expect(() => decodeSession("{\"version\":2,\"tracks\":[],\"rack\":\"{}\"}")).toThrow("Invalid Kahu testbed session")
    })
})
