// KBW-5 waveform authority: builds a bounded multiresolution min/max pyramid and extracts only the
// visible pixel range. The representation targets normal song/stem sources; long-form streaming is deferred.

export type WaveformPeaks = Readonly<{
    minimum: Float32Array
    maximum: Float32Array
}>

export type WaveformPeakLevel = Readonly<{
    samplesPerPeak: number
    minimum: Float32Array
    maximum: Float32Array
}>

export type WaveformPyramid = Readonly<{
    sampleCount: number
    levels: ReadonlyArray<WaveformPeakLevel>
}>

export const BASE_SAMPLES_PER_PEAK = 64

const safeSample = (samples: Float32Array, index: number): number => {
    const value = samples[index] ?? 0
    return Number.isFinite(value) ? value : 0
}

export const buildWaveformPyramid = (
    samples: Float32Array,
    baseSamplesPerPeak = BASE_SAMPLES_PER_PEAK,
): WaveformPyramid => {
    const base = Math.max(1, Math.floor(baseSamplesPerPeak))
    const minimum: number[] = []
    const maximum: number[] = []
    for (let start = 0; start < samples.length; start += base) {
        let min = safeSample(samples, start)
        let max = min
        for (let index = start + 1; index < Math.min(samples.length, start + base); index++) {
            const value = safeSample(samples, index)
            min = Math.min(min, value)
            max = Math.max(max, value)
        }
        minimum.push(min)
        maximum.push(max)
    }

    const levels: WaveformPeakLevel[] = [{
        samplesPerPeak: base,
        minimum: Float32Array.from(minimum),
        maximum: Float32Array.from(maximum),
    }]
    while ((levels[levels.length - 1]?.minimum.length ?? 0) > 1) {
        const previous = levels[levels.length - 1]!
        const nextMinimum = new Float32Array(Math.ceil(previous.minimum.length / 2))
        const nextMaximum = new Float32Array(nextMinimum.length)
        for (let index = 0; index < nextMinimum.length; index++) {
            const first = index * 2
            const second = Math.min(first + 1, previous.minimum.length - 1)
            nextMinimum[index] = Math.min(previous.minimum[first] ?? 0, previous.minimum[second] ?? 0)
            nextMaximum[index] = Math.max(previous.maximum[first] ?? 0, previous.maximum[second] ?? 0)
        }
        levels.push({
            samplesPerPeak: previous.samplesPerPeak * 2,
            minimum: nextMinimum,
            maximum: nextMaximum,
        })
    }
    return {sampleCount: samples.length, levels}
}

export const chooseWaveformLevel = (
    pyramid: WaveformPyramid,
    samplesPerPixel: number,
): WaveformPeakLevel => {
    const requested = Math.max(1, samplesPerPixel)
    let selected = pyramid.levels[0]!
    for (const level of pyramid.levels) {
        if (level.samplesPerPeak <= requested) selected = level
        else break
    }
    return selected
}

export const extractVisibleWaveformPeaks = (
    pyramid: WaveformPyramid,
    viewportStartSamples: number,
    viewportEndSamples: number,
    pixelWidth: number,
): WaveformPeaks => {
    const width = Math.max(1, Math.floor(pixelWidth))
    const start = Math.max(0, Math.min(pyramid.sampleCount, viewportStartSamples))
    const end = Math.max(start + 1, Math.min(pyramid.sampleCount, viewportEndSamples))
    const samplesPerPixel = (end - start) / width
    const level = chooseWaveformLevel(pyramid, samplesPerPixel)
    const minimum = new Float32Array(width)
    const maximum = new Float32Array(width)
    for (let pixel = 0; pixel < width; pixel++) {
        const pixelStart = start + pixel * samplesPerPixel
        const pixelEnd = start + (pixel + 1) * samplesPerPixel
        const firstPeak = Math.max(0, Math.floor(pixelStart / level.samplesPerPeak))
        const lastPeak = Math.min(
            level.minimum.length - 1,
            Math.max(firstPeak, Math.ceil(pixelEnd / level.samplesPerPeak) - 1),
        )
        let min = 0
        let max = 0
        for (let peak = firstPeak; peak <= lastPeak; peak++) {
            min = Math.min(min, level.minimum[peak] ?? 0)
            max = Math.max(max, level.maximum[peak] ?? 0)
        }
        minimum[pixel] = min
        maximum[pixel] = max
    }
    return {minimum, maximum}
}

export const computeWaveformPeaks = (samples: Float32Array, columns: number): WaveformPeaks => {
    const pyramid = buildWaveformPyramid(samples, Math.max(1, Math.floor(samples.length / Math.max(1, columns))))
    return extractVisibleWaveformPeaks(pyramid, 0, samples.length, columns)
}

export const buildWaveformPyramidAsync = (samples: Float32Array): Promise<WaveformPyramid> => {
    if (typeof Worker === "undefined") return Promise.resolve(buildWaveformPyramid(samples))
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./waveform-worker.ts", import.meta.url), {type: "module"})
        worker.onmessage = event => {
            worker.terminate()
            if (event.data.type === "error") {
                reject(new Error(event.data.message))
            } else {
                resolve(event.data.pyramid as WaveformPyramid)
            }
        }
        worker.onerror = event => {
            worker.terminate()
            reject(event.error instanceof Error ? event.error : new Error("Waveform worker failed."))
        }
        const copy = samples.slice()
        worker.postMessage({type: "build", samples: copy}, [copy.buffer])
    })
}
