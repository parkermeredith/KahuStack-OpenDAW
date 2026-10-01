// KOD-3 waveform analysis reduces decoded source samples to bounded visible-column peaks.

export type WaveformPeaks = Readonly<{
    minimum: Float32Array
    maximum: Float32Array
}>

export const computeWaveformPeaks = (samples: Float32Array, columns: number): WaveformPeaks => {
    const safeColumns = Math.max(1, Math.floor(columns))
    const minimum = new Float32Array(safeColumns)
    const maximum = new Float32Array(safeColumns)
    for (let column = 0; column < safeColumns; column++) {
        const start = Math.floor(column * samples.length / safeColumns)
        const end = Math.max(start + 1, Math.floor((column + 1) * samples.length / safeColumns))
        let min = 0
        let max = 0
        for (let index = start; index < Math.min(end, samples.length); index++) {
            const sample = samples[index]
            min = Math.min(min, sample)
            max = Math.max(max, sample)
        }
        minimum[column] = min
        maximum[column] = max
    }
    return {minimum, maximum}
}
