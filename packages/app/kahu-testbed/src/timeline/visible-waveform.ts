// KUI-5 alignment authority: projects one AudioRegion and the shared TimelineRange into the visible
// timeline interval and its source-sample interval. Rendering consumes this result without scanning
// or rebuilding the multiresolution waveform pyramid.

import {TimelineRange} from "@opendaw/studio-core"
import type {AudioRegion} from "../region"

export type VisibleWaveformProjection = Readonly<{
    timelineStartSeconds: number
    timelineEndSeconds: number
    sourceStartSamples: number
    sourceEndSamples: number
    leftPixels: number
    rightPixels: number
}>

export const projectVisibleWaveform = (
    range: TimelineRange,
    region: AudioRegion,
    sampleRate: number,
): VisibleWaveformProjection | undefined => {
    const regionStart = Math.max(0, region.timelineStartSeconds)
    const regionEnd = regionStart + Math.max(0, region.durationSeconds)
    const timelineStartSeconds = Math.max(regionStart, range.unitMin)
    const timelineEndSeconds = Math.min(regionEnd, range.unitMax)
    if (timelineEndSeconds <= timelineStartSeconds || !Number.isFinite(sampleRate) || sampleRate <= 0) {
        return undefined
    }
    const sourceStartSeconds = Math.max(0, region.sourceOffsetSeconds + timelineStartSeconds - regionStart)
    const sourceEndSeconds = Math.max(sourceStartSeconds,
        region.sourceOffsetSeconds + timelineEndSeconds - regionStart)
    return {
        timelineStartSeconds,
        timelineEndSeconds,
        sourceStartSamples: sourceStartSeconds * sampleRate,
        sourceEndSamples: sourceEndSeconds * sampleRate,
        leftPixels: range.unitToX(timelineStartSeconds),
        rightPixels: range.unitToX(timelineEndSeconds),
    }
}

export const projectRegionPixels = (
    range: TimelineRange,
    regionStartSeconds: number,
    regionDurationSeconds: number,
): Readonly<{leftPixels: number, rightPixels: number, widthPixels: number}> => {
    const leftPixels = range.unitToX(Math.max(0, regionStartSeconds))
    const rightPixels = range.unitToX(Math.max(0, regionStartSeconds + Math.max(0, regionDurationSeconds)))
    return {leftPixels, rightPixels, widthPixels: Math.max(0, rightPixels - leftPixels)}
}
