// KOD-9 session boundary: persists recoverable rack/track metadata without copying browser audio data.

import type {RackStore} from "./rack-store"
import type {TrackState} from "./track-store"

export type SessionTrack = Readonly<{
    id: string
    name: string
    fileName: string
    durationSeconds: number
    sampleRate: number
    channelCount: number
}>

export type TestbedSession = Readonly<{
    version: 1
    tracks: ReadonlyArray<SessionTrack>
    rack: string
}>

export const SESSION_STORAGE_KEY = "kahustack-dsp-testbed.session.v1"

export const createSession = (tracks: ReadonlyArray<TrackState>, rack: RackStore): TestbedSession => ({
    version: 1,
    tracks: tracks.map(track => ({
        id: track.id,
        name: track.name,
        fileName: track.audio.name,
        durationSeconds: track.audio.durationSeconds,
        sampleRate: track.audio.sampleRate,
        channelCount: track.audio.channelCount
    })),
    rack: rack.serialize()
})

export const encodeSession = (session: TestbedSession): string => JSON.stringify(session)

export const decodeSession = (serialized: string): TestbedSession => {
    const value: unknown = JSON.parse(serialized)
    if (!isTestbedSession(value)) {
        throw new Error("Invalid Kahu testbed session.")
    }
    return value
}

const isTestbedSession = (value: unknown): value is TestbedSession => {
    if (typeof value !== "object" || value === null) {
        return false
    }
    const candidate = value as {version?: unknown, tracks?: unknown, rack?: unknown}
    return candidate.version === 1 && Array.isArray(candidate.tracks) && typeof candidate.rack === "string"
}
