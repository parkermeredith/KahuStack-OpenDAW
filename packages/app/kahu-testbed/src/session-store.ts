// KBW-12 session boundary: persists versioned recoverable rack/track/view metadata without copying
// browser audio data. Source files remain explicit owner-provided inputs during recovery.

import type {RackStore} from "./rack-store"
import type {TrackState} from "./track-store"
import type {AudioRegion} from "./region"

export type SessionTrack = Readonly<{
    id: string
    name: string
    fileName: string
    durationSeconds: number
    sampleRate: number
    channelCount: number
    muted: boolean
    solo: boolean
    gain: number
    region: AudioRegion
}>

export type TestbedSession = Readonly<{
    version: 2
    tracks: ReadonlyArray<SessionTrack>
    rack: string
    selectedTrackId?: string
    viewport: Readonly<{zoom: number, scrollFraction: number}>
}>

export const SESSION_STORAGE_KEY = "kahustack-dsp-testbed.session.v2"

export const createSession = (
    tracks: ReadonlyArray<TrackState>,
    rack: RackStore,
    selectedTrackId?: string,
    viewport: Readonly<{zoom: number, scrollFraction: number}> = {zoom: 1, scrollFraction: 0},
): TestbedSession => ({
    version: 2,
    tracks: tracks.map(track => ({
        id: track.id,
        name: track.name,
        fileName: track.audio.name,
        durationSeconds: track.audio.durationSeconds,
        sampleRate: track.audio.sampleRate,
        channelCount: track.audio.channelCount,
        muted: track.muted,
        solo: track.solo,
        gain: track.gain,
        region: track.region,
    })),
    rack: rack.serialize(),
    selectedTrackId,
    viewport: {
        zoom: Math.min(16, Math.max(1, viewport.zoom)),
        scrollFraction: Math.min(1, Math.max(0, viewport.scrollFraction)),
    },
})

export const encodeSession = (session: TestbedSession): string => JSON.stringify(session)

export const decodeSession = (serialized: string): TestbedSession => {
    const value: unknown = JSON.parse(serialized)
    if (!isTestbedSession(value)) {
        throw new Error("Invalid Kahu testbed session.")
    }
    if (value.version === 1) return migrateV1(value)
    return value
}

type LegacySession = Readonly<{
    version: 1
    tracks: ReadonlyArray<Readonly<{id: string, name: string, fileName: string, durationSeconds: number, sampleRate: number, channelCount: number}>>
    rack: string
}>

const isTestbedSession = (value: unknown): value is TestbedSession | LegacySession => {
    if (typeof value !== "object" || value === null) {
        return false
    }
    const candidate = value as {version?: unknown, tracks?: unknown, rack?: unknown}
    if (candidate.version !== 1 && candidate.version !== 2) return false
    if (!Array.isArray(candidate.tracks) || typeof candidate.rack !== "string") return false
    if (candidate.version === 2) {
        const modern = candidate as {viewport?: unknown}
        if (!isViewport(modern.viewport)) return false
    }
    return candidate.tracks.every(track => isSessionTrack(track, candidate.version === 2))
}

const isSessionTrack = (value: unknown, modern: boolean): boolean => {
    if (typeof value !== "object" || value === null) return false
    const track = value as Record<string, unknown>
    const base = typeof track.id === "string" && typeof track.name === "string"
        && typeof track.fileName === "string" && finiteNonNegative(track.durationSeconds)
        && finitePositive(track.sampleRate) && Number.isInteger(track.channelCount) && Number(track.channelCount) > 0
    if (!base || !modern) return base
    return typeof track.muted === "boolean" && typeof track.solo === "boolean"
        && typeof track.gain === "number" && Number.isFinite(track.gain)
        && isAudioRegion(track.region)
}

const finiteNonNegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0
const finitePositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0

const isAudioRegion = (value: unknown): value is AudioRegion => {
    if (typeof value !== "object" || value === null) return false
    const region = value as Record<string, unknown>
    return finiteNonNegative(region.timelineStartSeconds)
        && finiteNonNegative(region.sourceOffsetSeconds)
        && finiteNonNegative(region.durationSeconds)
}

const isViewport = (value: unknown): value is {zoom: number, scrollFraction: number} => {
    if (typeof value !== "object" || value === null) return false
    const viewport = value as Record<string, unknown>
    return finitePositive(viewport.zoom) && finiteNonNegative(viewport.scrollFraction)
        && viewport.scrollFraction <= 1
}

const migrateV1 = (session: LegacySession): TestbedSession => ({
    version: 2,
    tracks: session.tracks.map(track => ({
        ...track,
        muted: false,
        solo: false,
        gain: 1,
        region: {timelineStartSeconds: 0, sourceOffsetSeconds: 0, durationSeconds: track.durationSeconds},
    })),
    rack: session.rack,
    viewport: {zoom: 1, scrollFraction: 0},
})
