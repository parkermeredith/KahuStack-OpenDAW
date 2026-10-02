import type {DecodedAudioFile} from "./audio-track"
import type {SessionTrack} from "./session-store"

export const SOURCE_DURATION_TOLERANCE_SECONDS = 0.05

export const matchesRecoverableSource = (sessionTrack: SessionTrack, source: DecodedAudioFile): boolean =>
    sessionTrack.fileName.toLocaleLowerCase() === source.name.toLocaleLowerCase()
    && sessionTrack.channelCount === source.channelCount
    && Math.abs(sessionTrack.durationSeconds - source.durationSeconds) <= SOURCE_DURATION_TOLERANCE_SECONDS

export const findRecoverableSessionTrack = (
    sessionTracks: ReadonlyArray<SessionTrack>,
    recoveredTrackIds: ReadonlySet<string>,
    source: DecodedAudioFile,
): SessionTrack | undefined => sessionTracks.find(candidate =>
    !recoveredTrackIds.has(candidate.id) && matchesRecoverableSource(candidate, source))
