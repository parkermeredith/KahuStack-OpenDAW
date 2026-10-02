// KUI-7/KBW-15 session authority: persists normalized timeline/channel state while retaining exact legacy
// migration at the serialization boundary. Source audio remains an explicit browser-local recovery input.

import type {RackStore} from "./rack-store"
import type {TrackState} from "./track-store"
import type {AudioRegion} from "./region"
import type {TransportLoop} from "./transport"

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
    pan: number
    region: AudioRegion
}>

export type SessionViewport = Readonly<{min: number, max: number}>

export type TestbedSession = Readonly<{
    version: 5
    tracks: ReadonlyArray<SessionTrack>
    rack: string
    selectedTrackId?: string
    viewport: SessionViewport
    loop: TransportLoop
    follow: boolean
}>

export const SESSION_STORAGE_KEY = "kahustack-dsp-testbed.session.v4"
export const LEGACY_SESSION_V3_STORAGE_KEY = "kahustack-dsp-testbed.session.v3"
export const LEGACY_SESSION_STORAGE_KEY = "kahustack-dsp-testbed.session.v2"

export const createSession = (
    tracks: ReadonlyArray<TrackState>,
    rack: RackStore,
    selectedTrackId?: string,
    viewport: SessionViewport = {min: 0, max: 1},
    loop: TransportLoop = {enabled: false, startSeconds: 0, endSeconds: 300},
    follow = false,
): TestbedSession => ({
    version: 5,
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
        pan: track.pan,
        region: track.region,
    })),
    rack: rack.serialize(),
    selectedTrackId,
    viewport: normalizeViewport(viewport.min, viewport.max),
    loop,
    follow,
})

export const encodeSession = (session: TestbedSession): string => JSON.stringify(session)

export const decodeSession = (serialized: string): TestbedSession => {
    const value: unknown = JSON.parse(serialized)
    if (!isTestbedSession(value)) throw new Error("Invalid Kahu testbed session.")
    if (value.version === 1) return migrateV1(value)
    if (value.version === 2) return migrateV2(value)
    if (value.version === 3) return migrateV3(value)
    if (value.version === 4) return migrateV4(value)
    return value
}

type LegacySession = Readonly<{
    version: 1
    tracks: ReadonlyArray<Readonly<{
        id: string
        name: string
        fileName: string
        durationSeconds: number
        sampleRate: number
        channelCount: number
    }>>
    rack: string
}>

type LegacyModernSessionTrack = Readonly<Omit<SessionTrack, "pan">>

type VersionTwoSession = Readonly<{
    version: 2
    tracks: ReadonlyArray<LegacyModernSessionTrack>
    rack: string
    selectedTrackId?: string
    viewport: Readonly<{zoom: number, scrollFraction: number}>
}>

type VersionThreeSession = Readonly<{
    version: 3
    tracks: ReadonlyArray<LegacyModernSessionTrack>
    rack: string
    selectedTrackId?: string
    viewport: SessionViewport
}>

type VersionFourSession = Readonly<{
    version: 4
    tracks: ReadonlyArray<LegacyModernSessionTrack>
    rack: string
    selectedTrackId?: string
    viewport: SessionViewport
    loop: TransportLoop
    follow: boolean
}>

const isTestbedSession = (value: unknown): value is TestbedSession | VersionFourSession | VersionThreeSession | VersionTwoSession | LegacySession => {
    if (typeof value !== "object" || value === null) return false
    const candidate = value as {version?: unknown, tracks?: unknown, rack?: unknown}
    if (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3
        && candidate.version !== 4 && candidate.version !== 5) return false
    if (!Array.isArray(candidate.tracks) || typeof candidate.rack !== "string") return false
    if (candidate.version === 2) {
        const modern = candidate as {viewport?: unknown}
        if (!isLegacyViewport(modern.viewport)) return false
    }
    if (candidate.version === 3) {
        const modern = candidate as {viewport?: unknown}
        if (!isNormalizedViewport(modern.viewport)) return false
    }
    if (candidate.version === 4 || candidate.version === 5) {
        const modern = candidate as {viewport?: unknown, loop?: unknown, follow?: unknown}
        if (!isNormalizedViewport(modern.viewport) || !isTransportLoop(modern.loop) || typeof modern.follow !== "boolean") return false
    }
    return candidate.tracks.every(track => isSessionTrack(track, candidate.version))
}

const isTransportLoop = (value: unknown): value is TransportLoop => {
    if (typeof value !== "object" || value === null) return false
    const loop = value as Record<string, unknown>
    return typeof loop.enabled === "boolean"
        && finiteNonNegative(loop.startSeconds)
        && finitePositive(loop.endSeconds)
        && loop.endSeconds > loop.startSeconds
}

const isSessionTrack = (value: unknown, version: 1 | 2 | 3 | 4 | 5): boolean => {
    if (typeof value !== "object" || value === null) return false
    const track = value as Record<string, unknown>
    const base = typeof track.id === "string" && typeof track.name === "string"
        && typeof track.fileName === "string" && finiteNonNegative(track.durationSeconds)
        && finitePositive(track.sampleRate) && Number.isInteger(track.channelCount) && Number(track.channelCount) > 0
    if (!base || version === 1) return base
    const modern = typeof track.muted === "boolean" && typeof track.solo === "boolean"
        && typeof track.gain === "number" && Number.isFinite(track.gain)
        && isAudioRegion(track.region)
    if (!modern || version < 5) return modern
    return typeof track.pan === "number" && Number.isFinite(track.pan) && track.pan >= -1 && track.pan <= 1
}

const finiteNonNegative = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
const finitePositive = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0

const isAudioRegion = (value: unknown): value is AudioRegion => {
    if (typeof value !== "object" || value === null) return false
    const region = value as Record<string, unknown>
    return finiteNonNegative(region.timelineStartSeconds)
        && finiteNonNegative(region.sourceOffsetSeconds)
        && finiteNonNegative(region.durationSeconds)
}

const isLegacyViewport = (value: unknown): value is {zoom: number, scrollFraction: number} => {
    if (typeof value !== "object" || value === null) return false
    const viewport = value as Record<string, unknown>
    return finitePositive(viewport.zoom) && finiteNonNegative(viewport.scrollFraction)
        && viewport.scrollFraction <= 1
}

const isNormalizedViewport = (value: unknown): value is SessionViewport => {
    if (typeof value !== "object" || value === null) return false
    const viewport = value as Record<string, unknown>
    return finiteNonNegative(viewport.min) && finiteNonNegative(viewport.max)
        && viewport.min <= 1 && viewport.max <= 1 && viewport.max > viewport.min
}

const normalizeViewport = (min: number, max: number): SessionViewport => {
    let safeMin = Number.isFinite(min) ? Math.min(1, Math.max(0, min)) : 0
    let safeMax = Number.isFinite(max) ? Math.min(1, Math.max(0, max)) : 1
    if (safeMax <= safeMin) {
        safeMin = 0
        safeMax = 1
    }
    return {min: safeMin, max: safeMax}
}

const withCenteredPan = (tracks: ReadonlyArray<LegacyModernSessionTrack>): ReadonlyArray<SessionTrack> =>
    tracks.map(track => ({...track, pan: 0}))

const defaultLoop = (tracks: ReadonlyArray<Readonly<{durationSeconds: number}>>): TransportLoop => ({
    enabled: false,
    startSeconds: 0,
    endSeconds: Math.max(300, ...tracks.map(track => track.durationSeconds)),
})

const migrateV2 = (session: VersionTwoSession): TestbedSession => {
    const zoom = Math.min(8, Math.max(1, session.viewport.zoom))
    const length = 1 / zoom
    const min = Math.min(1, Math.max(0, session.viewport.scrollFraction)) * (1 - length)
    return {
        version: 5,
        tracks: withCenteredPan(session.tracks),
        rack: session.rack,
        selectedTrackId: session.selectedTrackId,
        viewport: normalizeViewport(min, min + length),
        loop: defaultLoop(session.tracks),
        follow: false,
    }
}

const migrateV1 = (session: LegacySession): TestbedSession => {
    const tracks: ReadonlyArray<SessionTrack> = session.tracks.map(track => ({
        ...track,
        muted: false,
        solo: false,
        gain: 1,
        pan: 0,
        region: {timelineStartSeconds: 0, sourceOffsetSeconds: 0, durationSeconds: track.durationSeconds},
    }))
    return {
        version: 5,
        tracks,
        rack: session.rack,
        viewport: {min: 0, max: 1},
        loop: defaultLoop(tracks),
        follow: false,
    }
}

const migrateV3 = (session: VersionThreeSession): TestbedSession => ({
    version: 5,
    tracks: withCenteredPan(session.tracks),
    rack: session.rack,
    selectedTrackId: session.selectedTrackId,
    viewport: session.viewport,
    loop: defaultLoop(session.tracks),
    follow: false,
})

const migrateV4 = (session: VersionFourSession): TestbedSession => ({
    version: 5,
    tracks: withCenteredPan(session.tracks),
    rack: session.rack,
    selectedTrackId: session.selectedTrackId,
    viewport: session.viewport,
    loop: session.loop,
    follow: session.follow,
})
