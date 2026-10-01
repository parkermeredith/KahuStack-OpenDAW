// KBW-4 minimal region timing: maps a track's timeline entrance and source offset to bounded playback plans.
// This deliberately stops at one simple source region; fades, slicing, warping, and automation remain out of scope.

export type AudioRegion = {
    timelineStartSeconds: number
    sourceOffsetSeconds: number
    durationSeconds: number
}

export type RegionPlaybackPlan = Readonly<{
    delaySeconds: number
    sourceOffsetSeconds: number
    durationSeconds: number
}>

export const createAudioRegion = (sourceDurationSeconds: number): AudioRegion => ({
    timelineStartSeconds: 0,
    sourceOffsetSeconds: 0,
    durationSeconds: Math.max(0, sourceDurationSeconds),
})

export const planRegionPlayback = (
    region: AudioRegion,
    transportPositionSeconds: number,
    sourceDurationSeconds: number,
): RegionPlaybackPlan | undefined => {
    const sourceOffsetSeconds = Math.min(
        Math.max(0, region.sourceOffsetSeconds),
        Math.max(0, sourceDurationSeconds),
    )
    const availableSourceSeconds = Math.max(0, sourceDurationSeconds - sourceOffsetSeconds)
    const regionDurationSeconds = Math.min(Math.max(0, region.durationSeconds), availableSourceSeconds)
    const regionStartSeconds = Math.max(0, region.timelineStartSeconds)
    const regionEndSeconds = regionStartSeconds + regionDurationSeconds
    const position = Math.max(0, transportPositionSeconds)
    if (regionDurationSeconds <= 0 || position >= regionEndSeconds) return undefined

    const delaySeconds = Math.max(0, regionStartSeconds - position)
    const elapsedRegionSeconds = Math.max(0, position - regionStartSeconds)
    return {
        delaySeconds,
        sourceOffsetSeconds: sourceOffsetSeconds + elapsedRegionSeconds,
        durationSeconds: regionDurationSeconds - elapsedRegionSeconds,
    }
}
