// KBW-4/15 track authority: stable identity, channel state, and one minimal timed source region per track.

import type {DecodedAudioFile} from "./audio-track"
import {createAudioRegion, type AudioRegion} from "./region"

export type TrackState = {
    readonly id: string
    readonly audio: DecodedAudioFile
    name: string
    muted: boolean
    solo: boolean
    gain: number
    pan: number
    region: AudioRegion
}

export type RestoredTrackState = Readonly<Partial<Pick<TrackState, "id" | "name" | "muted" | "solo" | "gain" | "pan" | "region">>>

export class TrackStore {
    private readonly tracks = new Map<string, TrackState>()
    private nextId = 1
    private selectedTrackId: string | undefined

    add(audio: DecodedAudioFile, restored?: RestoredTrackState): TrackState {
        const restoredId = restored?.id
        const id = typeof restoredId === "string" && /^track-\d+$/.test(restoredId) && !this.tracks.has(restoredId)
            ? restoredId
            : `track-${this.nextId.toString().padStart(2, "0")}`
        const numericId = Number(id.replace("track-", ""))
        this.nextId = Math.max(this.nextId + 1, Number.isFinite(numericId) ? numericId + 1 : this.nextId)
        const durationSeconds = Math.max(0, audio.durationSeconds)
        const restoredRegion = restored?.region
        const sourceOffsetSeconds = clamp(
            restoredRegion?.sourceOffsetSeconds,
            0,
            durationSeconds,
        )
        const duration = clamp(
            restoredRegion?.durationSeconds,
            0,
            durationSeconds - sourceOffsetSeconds,
        )
        const track: TrackState = {
            id,
            audio,
            name: typeof restored?.name === "string" && restored.name.length > 0 ? restored.name : audio.name,
            muted: restored?.muted ?? false,
            solo: restored?.solo ?? false,
            gain: clamp(restored?.gain, 0, 1, 1),
            pan: clamp(restored?.pan, -1, 1, 0),
            region: restoredRegion === undefined
                ? createAudioRegion(durationSeconds)
                : {
                    timelineStartSeconds: clamp(restoredRegion.timelineStartSeconds, 0, Number.MAX_SAFE_INTEGER),
                    sourceOffsetSeconds,
                    durationSeconds: duration,
                },
        }
        this.tracks.set(id, track)
        this.selectedTrackId = id
        return track
    }

    remove(id: string): boolean {
        const removed = this.tracks.delete(id)
        if (removed && this.selectedTrackId === id) {
            this.selectedTrackId = this.tracks.keys().next().value
        }
        return removed
    }

    select(id: string): void {
        if (this.tracks.has(id)) {
            this.selectedTrackId = id
        }
    }

    selected(): TrackState | undefined {
        return this.selectedTrackId === undefined ? undefined : this.tracks.get(this.selectedTrackId)
    }

    all(): ReadonlyArray<TrackState> {
        return Array.from(this.tracks.values())
    }

    setMuted(id: string, muted: boolean): void {
        const track = this.tracks.get(id)
        if (track !== undefined) {
            track.muted = muted
        }
    }

    setSolo(id: string, solo: boolean): void {
        const track = this.tracks.get(id)
        if (track !== undefined) {
            track.solo = solo
        }
    }

    setGain(id: string, gain: number): void {
        const track = this.tracks.get(id)
        if (track !== undefined) {
            track.gain = Math.min(1, Math.max(0, gain))
        }
    }

    setPan(id: string, pan: number): void {
        const track = this.tracks.get(id)
        if (track !== undefined) {
            track.pan = Math.min(1, Math.max(-1, pan))
        }
    }

    setRegionTiming(id: string, timelineStartSeconds: number, sourceOffsetSeconds: number): void {
        const track = this.tracks.get(id)
        if (track === undefined) return
        const safeSourceOffset = Math.min(track.audio.durationSeconds, Math.max(0, sourceOffsetSeconds))
        track.region = {
            timelineStartSeconds: Math.max(0, timelineStartSeconds),
            sourceOffsetSeconds: safeSourceOffset,
            durationSeconds: Math.max(0, track.audio.durationSeconds - safeSourceOffset),
        }
    }

    isAudible(track: TrackState): boolean {
        return !track.muted && (!this.all().some(candidate => candidate.solo) || track.solo)
    }

    durationSeconds(): number {
        return this.all().reduce(
            (duration, track) => Math.max(duration, track.region.timelineStartSeconds + track.region.durationSeconds),
            0,
        )
    }
}

const clamp = (value: number | undefined, minimum: number, maximum: number, fallback = minimum): number => {
    if (value === undefined || !Number.isFinite(value)) return fallback
    return Math.min(maximum, Math.max(minimum, value))
}
