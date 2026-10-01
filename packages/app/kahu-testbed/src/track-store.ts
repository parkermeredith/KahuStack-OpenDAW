// KOD-4 track authority: stable track identity and selection/mute/solo/gain state for the testbed session.

import type {DecodedAudioFile} from "./audio-track"

export type TrackState = {
    readonly id: string
    readonly audio: DecodedAudioFile
    name: string
    muted: boolean
    solo: boolean
    gain: number
}

export class TrackStore {
    private readonly tracks = new Map<string, TrackState>()
    private nextId = 1
    private selectedTrackId: string | undefined

    add(audio: DecodedAudioFile): TrackState {
        const id = `track-${this.nextId.toString().padStart(2, "0")}`
        this.nextId += 1
        const track: TrackState = {id, audio, name: audio.name, muted: false, solo: false, gain: 1}
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

    isAudible(track: TrackState): boolean {
        return !track.muted && (!this.all().some(candidate => candidate.solo) || track.solo)
    }

    durationSeconds(): number {
        return this.all().reduce((duration, track) => Math.max(duration, track.audio.durationSeconds), 0)
    }
}
