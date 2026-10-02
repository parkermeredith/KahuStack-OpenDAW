// KBW-2 entrypoint: composes the isolated shell and metadata-driven browser host without owning DSP behavior.

import "./main.sass"
// The classic TypeScript JSX transform consumes createElement in generated output.
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import {replaceChildren, createElement} from "@opendaw/lib-jsx"
import {initializeColors} from "@opendaw/studio-enums"
import {TestbedShell} from "./shell"
import {DEFAULT_TRANSPORT_DURATION_SECONDS, Transport, TransportEpoch} from "./transport"
import {AudioTrackPlayer, decodeAudioFile} from "./audio-track"
import {buildWaveformPyramidAsync, extractVisibleWaveformPeaks, WaveformPyramid} from "./waveform"
import {TrackState, TrackStore} from "./track-store"
import {planRegionPlayback} from "./region"
import {TimelineViewport} from "./timeline"
import {RackStore} from "./rack-store"
import {KahuDeviceRuntime, KahuGainRuntime, KahuModuleManifest, KahuParameterManifest, KahuRackRuntime} from "./kahu-runtime"
import {
    controlStep,
    controlValueToParameterValue,
    editorKind,
    formatParameterValue,
    parameterValueToControlValue,
} from "./parameter-editor"
import {createSession, decodeSession, encodeSession, SESSION_STORAGE_KEY} from "./session-store"

initializeColors(document.documentElement)
document.title = TestbedShell.title

const audioContext = new AudioContext()
const monitorInput = audioContext.createGain()
const dryMonitor = audioContext.createGain()
const dryCompare = audioContext.createGain()
const processedCompare = audioContext.createGain()
const outputTrim = audioContext.createGain()
const analyser = audioContext.createAnalyser()
analyser.fftSize = 256
monitorInput.connect(processedCompare)
dryMonitor.connect(dryCompare)
processedCompare.connect(outputTrim)
dryCompare.connect(outputTrim)
outputTrim.connect(analyser)
analyser.connect(audioContext.destination)
const transport = new Transport(() => audioContext.currentTime)
const timelineViewport = new TimelineViewport()
const trackStore = new TrackStore()
const rackStore = new RackStore()
const audioPlayers = new Map<string, AudioTrackPlayer>()
const waveformPyramids = new Map<string, WaveformPyramid>()
const waveformBuilds = new Map<string, Promise<WaveformPyramid>>()
const CONSOLIDATED_RACK_RUNTIME = true
const kahuRuntimes = new Map<string, KahuDeviceRuntime>()
const rackHosts = new Map<string, KahuRackRuntime>()
const runtimeErrors = new Map<string, string>()
let catalogModules: ReadonlyArray<KahuModuleManifest> = []
let timeReadout: HTMLElement | undefined
let musicalReadout: HTMLElement | undefined
let playhead: HTMLElement | undefined
let seekInput: HTMLInputElement | undefined
let positionInput: HTMLInputElement | undefined
let timelineStartInput: HTMLInputElement | undefined
let sourceOffsetInput: HTMLInputElement | undefined
let timelineLaneList: HTMLElement | undefined
let timelineScroll: HTMLElement | undefined
let timelineContent: HTMLElement | undefined
let playButton: HTMLButtonElement | undefined
let engineStatus: HTMLElement | undefined
let waveformCanvas: HTMLCanvasElement | undefined
let spectrumCanvas: HTMLCanvasElement | undefined
let audioStatus: HTMLElement | undefined
let audioMetadata: HTMLElement | undefined
let trackList: HTMLElement | undefined
let fileInput: HTMLInputElement | undefined
let rackList: HTMLElement | undefined
let rackTitle: HTMLElement | undefined
let addRackSlotButton: HTMLButtonElement | undefined
let modulePicker: HTMLSelectElement | undefined
let meterFill: HTMLElement | undefined
let meterReadout: HTMLElement | undefined
let bypassAllButton: HTMLButtonElement | undefined
let bypassAll = false
let compareDry = false
let inputTrimDb = 0
let outputTrimDb = 0

const setMonitorComparison = (): void => {
    dryCompare.gain.setValueAtTime(compareDry ? 1 : 0, audioContext.currentTime)
    processedCompare.gain.setValueAtTime(compareDry ? 0 : 1, audioContext.currentTime)
}

const setOutputTrim = (): void => {
    outputTrim.gain.setValueAtTime(10 ** (outputTrimDb / 20), audioContext.currentTime)
}

setMonitorComparison()
setOutputTrim()
let animationFrame = 0
let waveformZoom = 1

const saveSession = (): void => {
    try {
        const viewport = timelineViewport.snapshot()
        localStorage.setItem(
            SESSION_STORAGE_KEY,
            encodeSession(createSession(trackStore.all(), rackStore, trackStore.selected()?.id, viewport)),
        )
        engineStatus?.replaceChildren("SESSION SAVED · SOURCE FILES LOCAL")
    } catch {
        engineStatus?.replaceChildren("SESSION SAVE FAILED")
    }
}

const recoverSession = (): void => {
    try {
        const serialized = localStorage.getItem(SESSION_STORAGE_KEY)
        if (serialized === null) {
            engineStatus?.replaceChildren("NO SAVED SESSION")
            return
        }
        const session = decodeSession(serialized)
        timelineViewport.setZoom(session.viewport.zoom)
        timelineViewport.setScrollFraction(session.viewport.scrollFraction)
        if (session.selectedTrackId !== undefined) trackStore.select(session.selectedTrackId)
        rackStore.restore(session.rack)
        refreshRack()
        for (const track of trackStore.all()) {
            for (const device of rackStore.devicesFor(track.id)) {
                if (device.moduleId !== undefined) {
                    void initializeRuntime(track.id, device.id, device.moduleId)
                }
            }
        }
        engineStatus?.replaceChildren("SESSION RECOVERED · RESELECT SOURCE AUDIO")
    } catch {
        engineStatus?.replaceChildren("SESSION RECOVERY FAILED")
    }
}

const refreshTransport = (): void => {
    const snapshot = transport.snapshot()
    refreshMeter()
    timeReadout?.replaceChildren(snapshot.timecode)
    musicalReadout?.replaceChildren(snapshot.musicalPosition)
    playButton?.replaceChildren(snapshot.isPlaying ? "Ⅱ" : "▶")
    playButton?.setAttribute("aria-label", snapshot.isPlaying ? "Pause" : "Play")
    playhead?.style.setProperty("left", `${timelineViewport.positionPercent(snapshot.positionSeconds)}%`)
    if (seekInput !== undefined) {
        seekInput.value = snapshot.positionSeconds.toString()
        seekInput.max = snapshot.durationSeconds.toString()
    }
    if (positionInput !== undefined && document.activeElement !== positionInput) {
        positionInput.value = snapshot.positionSeconds.toFixed(2)
        positionInput.max = snapshot.durationSeconds.toString()
    }
    if (snapshot.isPlaying) {
        animationFrame = requestAnimationFrame(refreshTransport)
    } else {
        animationFrame = 0
    }
}

const refreshMeter = (): void => {
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    let peak = 0
    for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample))
    }
    const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity
    meterFill?.style.setProperty("width", `${Math.min(1, peak) * 100}%`)
    meterReadout?.replaceChildren(Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : "-∞ dBFS")
    const canvas = spectrumCanvas
    const context = canvas?.getContext("2d")
    if (canvas !== undefined && context !== null && context !== undefined) {
        const frequencies = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(frequencies)
        const width = canvas.width = Math.max(1, Math.floor(canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1)))
        const height = canvas.height = Math.max(1, Math.floor(canvas.clientHeight * Math.min(2, window.devicePixelRatio || 1)))
        context.clearRect(0, 0, width, height)
        context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-green")
        const barWidth = width / 24
        for (let bar = 0; bar < 24; bar++) {
            const index = Math.min(frequencies.length - 1, Math.floor((bar / 24) ** 1.8 * frequencies.length))
            const normalized = Math.max(0, Math.min(1, (frequencies[index] + 96) / 96))
            context.fillRect(bar * barWidth, height * (1 - normalized), Math.max(1, barWidth - 1), height * normalized)
        }
    }
}

const restartTransportRefresh = (): void => {
    if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame)
    }
    refreshTransport()
}

const seekFromInput = (value: string): void => {
    const position = Number(value)
    const epoch = transport.seek(position)
    if (epoch !== undefined) {
        playAllPlayers(epoch)
    } else {
        for (const player of audioPlayers.values()) {
            player.seek(position)
        }
    }
    restartTransportRefresh()
}

const drawWaveform = (track: TrackState): void => {
    const canvas = waveformCanvas
    const context = canvas?.getContext("2d")
    const pyramid = waveformPyramids.get(track.id)
    if (canvas === undefined || context === null || context === undefined || pyramid === undefined) {
        return
    }
    const logicalWidth = Math.max(1, canvas.parentElement?.clientWidth ?? canvas.clientWidth ?? 1200)
    const logicalHeight = Math.max(1, canvas.parentElement?.clientHeight ?? canvas.clientHeight ?? 160)
    const devicePixelRatio = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const physicalWidth = Math.max(1, Math.floor(logicalWidth * devicePixelRatio))
    const physicalHeight = Math.max(1, Math.floor(logicalHeight * devicePixelRatio))
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth
        canvas.height = physicalHeight
    }
    const visibleSamples = Math.max(1, pyramid.sampleCount / waveformZoom)
    const peaks = extractVisibleWaveformPeaks(pyramid, 0, visibleSamples, physicalWidth)
    const height = physicalHeight
    const midpoint = height / 2
    context.clearRect(0, 0, canvas.width, height)
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-green")
    for (let column = 0; column < peaks.minimum.length; column++) {
        const top = midpoint - peaks.maximum[column] * midpoint * 0.85
        const bottom = midpoint - peaks.minimum[column] * midpoint * 0.85
        context.fillRect(column, top, 1, Math.max(1, bottom - top))
    }
}

const ensureWaveformPyramid = (track: TrackState): void => {
    if (waveformPyramids.has(track.id) || waveformBuilds.has(track.id)) {
        drawWaveform(track)
        return
    }
    const build = buildWaveformPyramidAsync(track.audio.buffer.getChannelData(0))
    waveformBuilds.set(track.id, build)
    void build.then(pyramid => {
        waveformBuilds.delete(track.id)
        waveformPyramids.set(track.id, pyramid)
        if (trackStore.selected()?.id === track.id) drawWaveform(track)
    }).catch(() => {
        waveformBuilds.delete(track.id)
        if (trackStore.selected()?.id === track.id) audioStatus?.replaceChildren("Waveform peak generation failed")
    })
}

const applyTrackGain = (track: TrackState): void => {
    const player = audioPlayers.get(track.id)
    player?.setGain(trackStore.isAudible(track) ? track.gain : 0)
    player?.setInputTrim(10 ** (inputTrimDb / 20))
}

const refreshTrackPlayers = (): void => {
    for (const track of trackStore.all()) {
        applyTrackGain(track)
    }
}

const refreshTrackDuration = (): void => {
    const duration = trackStore.durationSeconds()
    timelineViewport.setDuration(duration > 0 ? duration : DEFAULT_TRANSPORT_DURATION_SECONDS)
    transport.setDuration(duration > 0 ? duration : DEFAULT_TRANSPORT_DURATION_SECONDS)
    refreshTimelineLanes()
    restartTransportRefresh()
}

const updateSelectedTrack = (): void => {
    const track = trackStore.selected()
    if (track === undefined) {
        audioMetadata?.replaceChildren("WAV and browser-decodable audio")
        audioStatus?.replaceChildren("Drop audio or choose a file")
        waveformCanvas?.classList.add("hidden")
        return
    }
    audioMetadata?.replaceChildren(
        `${track.audio.durationSeconds.toFixed(2)} s · ${track.audio.sampleRate} Hz · ${track.audio.channelCount} ch `
        + `· region ${track.region.timelineStartSeconds.toFixed(2)} s / source ${track.region.sourceOffsetSeconds.toFixed(2)} s`,
    )
    if (timelineStartInput !== undefined) {
        timelineStartInput.value = track.region.timelineStartSeconds.toFixed(2)
    }
    if (sourceOffsetInput !== undefined) {
        sourceOffsetInput.value = track.region.sourceOffsetSeconds.toFixed(2)
        sourceOffsetInput.max = track.audio.durationSeconds.toString()
    }
    audioStatus?.replaceChildren("Audio ready — press Play")
    waveformCanvas?.classList.remove("hidden")
    ensureWaveformPyramid(track)
    refreshTimelineLanes()
}

const refreshTimelineLanes = (): void => {
    const root = timelineLaneList
    if (root === undefined) return
    root.replaceChildren()
    for (const track of trackStore.all()) {
        const row = document.createElement("div")
        row.className = `timeline-track-lane${trackStore.selected() === track ? " selected" : ""}`
        const label = document.createElement("span")
        label.className = "timeline-track-label"
        label.textContent = track.name
        const area = document.createElement("div")
        area.className = "timeline-track-area"
        const region = document.createElement("button")
        region.type = "button"
        region.className = "timeline-region"
        const style = timelineViewport.regionStyle(track.region.timelineStartSeconds, track.region.durationSeconds)
        region.style.left = `${style.leftPercent}%`
        region.style.width = `${style.widthPercent}%`
        region.textContent = `${track.name} · ${track.audio.durationSeconds.toFixed(1)} s`
        region.onclick = event => {
            event.stopPropagation()
            trackStore.select(track.id)
            refreshTrackList()
            updateSelectedTrack()
            refreshRack()
        }
        area.append(region)
        row.append(label, area)
        root.append(row)
    }
}

const removeTrack = (id: string): void => {
    audioPlayers.get(id)?.stop()
    audioPlayers.delete(id)
    for (const device of rackStore.devicesFor(id)) {
        kahuRuntimes.get(device.id)?.dispose()
        kahuRuntimes.delete(device.id)
        runtimeErrors.delete(device.id)
    }
    rackHosts.get(id)?.dispose()
    rackHosts.delete(id)
    trackStore.remove(id)
    rackStore.removeTrack(id)
    refreshTrackList()
    updateSelectedTrack()
    refreshTrackDuration()
    refreshRack()
}

const refreshTrackList = (): void => {
    const root = trackList
    if (root === undefined) {
        return
    }
    root.replaceChildren()
    const tracks = trackStore.all()
    if (tracks.length === 0) {
        const empty = document.createElement("div")
        empty.className = "track-empty"
        empty.textContent = "Load source audio to add a track."
        root.append(empty)
        return
    }
    for (const track of tracks) {
        const row = document.createElement("div")
        row.className = `track-row${trackStore.selected() === track ? " selected" : ""}`
        row.onclick = () => {
            trackStore.select(track.id)
            refreshTrackList()
            updateSelectedTrack()
            refreshRack()
        }
        const color = document.createElement("span")
        color.className = "track-color"
        const info = document.createElement("div")
        info.className = "track-info"
        const title = document.createElement("strong")
        title.textContent = track.name
        const summary = document.createElement("small")
        summary.textContent = `${track.audio.durationSeconds.toFixed(1)} s · ${track.id}`
        info.append(title, summary)
        const actions = document.createElement("div")
        actions.className = "track-actions"
        const mute = document.createElement("button")
        mute.className = `track-action${track.muted ? " active" : ""}`
        mute.type = "button"
        mute.textContent = "M"
        mute.title = "Mute track"
        mute.onclick = event => {
            event.stopPropagation()
            trackStore.setMuted(track.id, !track.muted)
            refreshTrackPlayers()
            refreshTrackList()
        }
        const solo = document.createElement("button")
        solo.className = `track-action${track.solo ? " active" : ""}`
        solo.type = "button"
        solo.textContent = "S"
        solo.title = "Solo track"
        solo.onclick = event => {
            event.stopPropagation()
            trackStore.setSolo(track.id, !track.solo)
            refreshTrackPlayers()
            refreshTrackList()
        }
        const remove = document.createElement("button")
        remove.className = "track-action remove"
        remove.type = "button"
        remove.textContent = "×"
        remove.title = "Remove track"
        remove.onclick = event => {
            event.stopPropagation()
            removeTrack(track.id)
        }
        actions.append(mute, solo, remove)
        const gain = document.createElement("input")
        gain.className = "track-gain"
        gain.type = "range"
        gain.min = "0"
        gain.max = "1"
        gain.step = "0.01"
        gain.value = track.gain.toString()
        gain.title = "Track gain"
        gain.setAttribute("aria-label", `${track.name} gain`)
        gain.oninput = event => {
            event.stopPropagation()
            trackStore.setGain(track.id, Number(gain.value))
            applyTrackGain(track)
        }
        row.append(color, info, actions, gain)
        root.append(row)
    }
}

const rebuildTrackRack = (trackId: string): void => {
    const player = audioPlayers.get(trackId)
    if (player === undefined) {
        return
    }
    const runtimes = rackStore.devicesFor(trackId)
        .map(device => kahuRuntimes.get(device.id))
        .filter((runtime): runtime is KahuDeviceRuntime => runtime !== undefined)
    if (CONSOLIDATED_RACK_RUNTIME) {
        const rack = rackHosts.get(trackId)
        if (rack !== undefined) {
            rack.connectOutput(monitorInput)
            player.setComparisonOutputs(rack.input, dryMonitor)
        } else {
            player.setOutput(dryMonitor)
        }
        return
    }
    for (let index = 0; index < runtimes.length; index++) {
        runtimes[index].connectOutput(runtimes[index + 1]?.output ?? monitorInput)
    }
    player.setOutput(runtimes[0]?.output ?? dryMonitor)
}

const parameterEditor = (
    track: TrackState,
    deviceId: string,
    deviceModuleId: string | undefined,
    deviceValues: Record<string, number>,
    runtime: KahuDeviceRuntime | undefined,
    parameter: KahuParameterManifest,
): HTMLElement => {
    const row = document.createElement("label")
    row.className = "rack-parameter"
    row.dataset.automation = parameter.automation
    row.dataset.transition = parameter.transition

    const heading = document.createElement("span")
    heading.className = "rack-parameter-heading"
    const name = document.createElement("strong")
    name.textContent = parameter.name
    const readout = document.createElement("small")
    const initialValue = runtime?.parameterValue(parameter.key) ?? deviceValues[parameter.key] ?? parameter.default
    readout.textContent = formatParameterValue(parameter, initialValue)
    heading.append(name, readout)

    const kind = editorKind(parameter)
    const updateValue = (controlValue: number): void => {
        const value = controlValueToParameterValue(parameter, controlValue)
        readout.textContent = formatParameterValue(parameter, value)
        rackStore.setParameter(track.id, deviceId, parameter.key, value)
        if (runtime === undefined) return
        if (parameter.automation === "reprepare") {
            engineStatus?.replaceChildren("RUST/WASM ENGINE · REPREPARE")
            void initializeRuntime(track.id, deviceId, deviceModuleId ?? runtime.moduleId)
        } else {
            runtime.setParameter(parameter.key, value)
        }
    }

    if (kind === "boolean") {
        const control = document.createElement("input")
        control.className = "rack-parameter-toggle"
        control.type = "checkbox"
        control.checked = initialValue >= 0.5
        control.disabled = runtime === undefined
        control.setAttribute("aria-label", `${parameter.name} ${parameter.automation}`)
        control.onchange = () => updateValue(control.checked ? 1 : 0)
        row.append(heading, control)
        return row
    }

    if (kind === "enum") {
        const control = document.createElement("select")
        control.className = "rack-parameter-select"
        control.disabled = runtime === undefined
        control.setAttribute("aria-label", `${parameter.name} ${parameter.automation}`)
        for (const [index, label] of (parameter.enum_values ?? []).entries()) {
            const option = document.createElement("option")
            option.value = index.toString()
            option.textContent = label
            control.append(option)
        }
        control.value = Math.round((initialValue - parameter.min) / parameter.step).toString()
        control.onchange = () => updateValue(Number(control.value))
        row.append(heading, control)
        return row
    }

    const control = document.createElement("input")
    control.className = "rack-parameter-range"
    control.type = "range"
    control.min = kind === "logarithmic" ? "0" : parameter.min.toString()
    control.max = kind === "logarithmic" ? "1" : parameter.max.toString()
    control.step = controlStep(parameter)
    control.value = parameterValueToControlValue(parameter, initialValue).toString()
    control.disabled = runtime === undefined
    control.title = `${parameter.key} · ${parameter.automation} · ${parameter.transition}`
    control.setAttribute("aria-label", `${parameter.name} ${parameter.automation}`)
    const event = parameter.automation === "reprepare" ? "change" : "input"
    control.addEventListener(event, () => updateValue(Number(control.value)))
    row.append(heading, control)
    return row
}

const refreshRack = (): void => {
    const root = rackList
    if (root === undefined) {
        return
    }
    root.replaceChildren()
    const track = trackStore.selected()
    if (track === undefined) {
        rackTitle?.replaceChildren("Kahu Rack")
        if (addRackSlotButton !== undefined) {
            addRackSlotButton.disabled = true
        }
        const empty = document.createElement("div")
        empty.className = "rack-empty"
        empty.textContent = "Select an audio track to view its effect chain."
        root.append(empty)
        return
    }
    rackTitle?.replaceChildren(`Kahu Rack · ${track.name}`)
    if (addRackSlotButton !== undefined) {
        addRackSlotButton.disabled = false
    }
    const devices = rackStore.devicesFor(track.id)
    if (devices.length === 0) {
        const empty = document.createElement("div")
        empty.className = "rack-empty"
        const title = document.createElement("strong")
        title.textContent = "Empty audio-effect chain"
        const hint = document.createElement("span")
        hint.textContent = "Choose a generated Kahu module and add it to this track."
        empty.append(title, hint)
        root.append(empty)
        return
    }
    for (const [index, device] of devices.entries()) {
        const runtime = kahuRuntimes.get(device.id)
        const card = document.createElement("article")
        card.className = `rack-device${device.bypassed ? " bypassed" : ""}`
        const cardHeader = document.createElement("div")
        cardHeader.className = "rack-device-header"
        const name = document.createElement("strong")
        name.textContent = runtime === undefined ? device.name : `${runtime.name} · ${runtime.moduleId}`
        const status = document.createElement("small")
        status.textContent = device.bypassed ? "BYPASSED" : runtime === undefined ? "RUNTIME PENDING" : "RUST/WASM ACTIVE"
        cardHeader.append(name, status)
        const body = document.createElement("p")
        body.textContent = runtime === undefined
            ? runtimeErrors.get(device.id) ?? "Waiting for the staged Kahu runtime"
            : `${runtime.moduleId} · ${runtime.latency} sample latency`
        const controls = document.createElement("div")
        controls.className = "rack-device-controls"
        const bypass = document.createElement("button")
        bypass.className = `rack-control${device.bypassed ? " active" : ""}`
        bypass.type = "button"
        bypass.textContent = "BYP"
        bypass.onclick = () => {
            rackStore.setBypassed(track.id, device.id, !device.bypassed)
            kahuRuntimes.get(device.id)?.setBypassed(!device.bypassed)
            refreshRack()
        }
        const moveLeft = document.createElement("button")
        moveLeft.className = "rack-control"
        moveLeft.type = "button"
        moveLeft.textContent = "‹"
        moveLeft.disabled = index === 0
        moveLeft.onclick = () => {
            rackStore.move(track.id, device.id, -1)
            rebuildTrackRack(track.id)
            if (runtime !== undefined && "move" in runtime) void runtime.move(-1)
            refreshRack()
        }
        const moveRight = document.createElement("button")
        moveRight.className = "rack-control"
        moveRight.type = "button"
        moveRight.textContent = "›"
        moveRight.disabled = index === devices.length - 1
        moveRight.onclick = () => {
            rackStore.move(track.id, device.id, 1)
            rebuildTrackRack(track.id)
            if (runtime !== undefined && "move" in runtime) void runtime.move(1)
            refreshRack()
        }
        const remove = document.createElement("button")
        remove.className = "rack-control remove"
        remove.type = "button"
        remove.textContent = "×"
        remove.onclick = () => {
            kahuRuntimes.get(device.id)?.dispose()
            kahuRuntimes.delete(device.id)
            runtimeErrors.delete(device.id)
            rackStore.remove(track.id, device.id)
            rebuildTrackRack(track.id)
            refreshRack()
        }
        if (runtime !== undefined) {
            const reset = document.createElement("button")
            reset.className = "rack-control"
            reset.type = "button"
            reset.textContent = "RST"
            reset.title = "Reset processor"
            reset.onclick = () => runtime.reset()
            controls.append(reset)
        }
        controls.append(bypass, moveLeft, moveRight, remove)
        const module = catalogModules.find(candidate => candidate.id === device.moduleId)
        const parameters = runtime?.parameters ?? module?.parameters ?? []
        const parameterRows = document.createElement("div")
        parameterRows.className = "rack-parameter-list"
        for (const parameter of parameters) {
            parameterRows.append(parameterEditor(track, device.id, device.moduleId, device.parameterValues, runtime, parameter))
        }
        card.append(cardHeader, body, parameterRows, controls)
        root.append(card)
    }
}

const initializeRuntime = async (trackId: string, deviceId: string, moduleId: string): Promise<void> => {
    const player = audioPlayers.get(trackId)
    if (player === undefined) {
        return
    }
    engineStatus?.replaceChildren("RUST/WASM ENGINE · LOADING")
    try {
        const runtime = CONSOLIDATED_RACK_RUNTIME
            ? await (async () => {
                let rack = rackHosts.get(trackId)
                if (rack === undefined) {
                    rack = await KahuRackRuntime.create(audioContext, 2, 128)
                    rackHosts.set(trackId, rack)
                }
                const module = catalogModules.find(candidate => candidate.id === moduleId)
                if (module === undefined) throw new Error(`Generated Kahu manifest does not contain ${moduleId}.`)
                kahuRuntimes.get(deviceId)?.dispose()
                return rack.addDevice(module)
            })()
            : await KahuGainRuntime.create(audioContext, 2, 128, moduleId)
        kahuRuntimes.get(deviceId)?.dispose()
        kahuRuntimes.set(deviceId, runtime)
        rebuildTrackRack(trackId)
        const device = rackStore.devicesFor(trackId).find(candidate => candidate.id === deviceId)
        for (const parameter of runtime.parameters) {
            runtime.setParameter(parameter.key, device?.parameterValues[parameter.key] ?? parameter.default)
        }
        runtime.setBypassed(bypassAll || (device?.bypassed ?? false))
        runtimeErrors.delete(deviceId)
        engineStatus?.replaceChildren("RUST/WASM ENGINE · READY")
        refreshRack()
    } catch (error) {
        runtimeErrors.set(deviceId, error instanceof Error ? error.message : "Kahu runtime initialization failed.")
        engineStatus?.replaceChildren("RUST/WASM ENGINE · UNAVAILABLE")
        refreshRack()
    }
}

const toggleBypassAll = (): void => {
    bypassAll = !bypassAll
    for (const runtime of kahuRuntimes.values()) {
        runtime.setBypassed(bypassAll)
    }
    bypassAllButton?.replaceChildren(bypassAll ? "BYPASS OFF" : "BYPASS ALL")
}

const handleAudioEnded = (): void => {
    if (transport.snapshot().isPlaying && !Array.from(audioPlayers.values()).some(player => player.isPlaying())) {
        transport.stop()
        restartTransportRefresh()
    }
}

const stopAllPlayers = (): void => {
    for (const player of audioPlayers.values()) {
        player.stop()
    }
}

const pauseAllPlayers = (positionSeconds: number): void => {
    for (const player of audioPlayers.values()) {
        player.pauseAt(positionSeconds)
    }
}

const playAllPlayers = (epoch: TransportEpoch): void => {
    for (const track of trackStore.all()) {
        const player = audioPlayers.get(track.id)
        if (player !== undefined) {
            applyTrackGain(track)
            const plan = planRegionPlayback(track.region, epoch.positionSeconds, track.audio.durationSeconds)
            if (plan === undefined) {
                player.stop()
            } else {
                player.playAt(
                    epoch.startTimeSeconds + plan.delaySeconds,
                    plan.sourceOffsetSeconds,
                    plan.durationSeconds,
                )
            }
        }
    }
}

const updateSelectedRegion = (): void => {
    const track = trackStore.selected()
    if (track === undefined) return
    trackStore.setRegionTiming(
        track.id,
        Number(timelineStartInput?.value ?? 0),
        Number(sourceOffsetInput?.value ?? 0),
    )
    refreshTrackDuration()
    updateSelectedTrack()
    const epoch = transport.reschedule()
    if (epoch !== undefined) playAllPlayers(epoch)
}

const loadAudio = async (file: File): Promise<void> => {
    try {
        const track = await decodeAudioFile(audioContext, file)
        const wasPlaying = transport.snapshot().isPlaying
        const state = trackStore.add(track)
        const player = new AudioTrackPlayer(audioContext, handleAudioEnded)
        player.load(track.buffer)
        audioPlayers.set(state.id, player)
        rebuildTrackRack(state.id)
        const device = rackStore.addModule(state.id, "utility.gain", "Gain", {gain_db: 0})
        refreshTrackList()
        updateSelectedTrack()
        refreshTrackDuration()
        void initializeRuntime(state.id, device.id, device.moduleId ?? "utility.gain")
        if (wasPlaying) {
            const epoch = transport.reschedule()
            if (epoch !== undefined) playAllPlayers(epoch)
        }
        restartTransportRefresh()
    } catch {
        audioStatus?.replaceChildren(`Unable to decode ${file.name}`)
        audioMetadata?.replaceChildren("Choose another browser-decodable audio file")
    }
}

const toggleTransport = async (): Promise<void> => {
    if (transport.snapshot().isPlaying) {
        const position = transport.pause()
        pauseAllPlayers(position)
    } else {
        await audioContext.resume()
        playAllPlayers(transport.play())
    }
    restartTransportRefresh()
}

const loadCatalog = async (): Promise<void> => {
    try {
        catalogModules = (await KahuGainRuntime.catalog()).modules
        if (modulePicker !== undefined) {
            modulePicker.replaceChildren()
            for (const module of catalogModules) {
                const option = document.createElement("option")
                option.value = module.id
                option.textContent = `${module.name} · ${module.id}`
                modulePicker.append(option)
            }
        }
    } catch {
        catalogModules = []
    }
}

replaceChildren(document.body, (
    <main className="testbed-shell">
        <header className="testbed-header">
            <div className="brand-lockup">
                <span className="brand-mark" aria-hidden="true">K</span>
                <div>
                    <h1>KahuStack DSP</h1>
                    <p>OpenDAW Testbed</p>
                </div>
            </div>
            <div className="header-divider" aria-hidden="true"/>
            <span className="phase-label">{TestbedShell.phase}</span>
            <div className="header-spacer"/>
            <span className="engine-status" onInit={element => engineStatus = element}>{TestbedShell.engineStatus}</span>
            <button className="header-button" type="button" onInit={element => element.onclick = saveSession}>SAVE</button>
            <button className="header-button" type="button" onInit={element => element.onclick = recoverSession}>RECOVER</button>
            <button className="header-button" type="button" disabled aria-label="Settings are not connected yet">
                SETUP
            </button>
        </header>
        <section className="workspace" aria-label="KahuStack DSP testbed workspace">
            <aside className="track-panel" aria-label="Track list">
                <div className="panel-heading">
                    <span>TRACKS</span>
                    <button className="icon-button" type="button" aria-label="Add track" onInit={element => {
                        element.onclick = () => fileInput?.click()
                    }}>+</button>
                </div>
                <div className="track-list" onInit={element => trackList = element}/>
            </aside>
            <section className="timeline-panel" aria-label="Timeline">
                <div className="timeline-toolbar">
                    <div className="transport-controls">
                        <button className="transport-button" type="button" aria-label="Play" onInit={element => {
                            playButton = element
                            element.onclick = () => {void toggleTransport()}
                        }}>▶</button>
                        <button className="stop-button" type="button" aria-label="Stop" onInit={element => {
                            element.onclick = () => {
                                stopAllPlayers()
                                transport.stop()
                                restartTransportRefresh()
                            }
                        }}>■</button>
                    </div>
                    <div className="time-readout">
                        <span onInit={element => timeReadout = element}>00:00:00</span>
                        <span className="musical-readout" onInit={element => musicalReadout = element}>1.1</span>
                    </div>
                    <input className="position-input" type="number" min="0" max={`${DEFAULT_TRANSPORT_DURATION_SECONDS}`}
                           step="0.01" value="0" aria-label="Seek position in seconds"
                           onInit={element => {
                               positionInput = element
                               element.onchange = () => seekFromInput(element.value)
                               element.onkeydown = event => {
                                   if (event.key === "Enter") {
                                       seekFromInput(element.value)
                                       element.blur()
                                   }
                               }
                           }}/>
                    <div className="region-controls" aria-label="Selected region timing">
                        <label>START
                            <input type="number" min="0" step="0.01" value="0" aria-label="Region timeline start"
                                   onInit={element => {
                                       timelineStartInput = element
                                       element.onchange = updateSelectedRegion
                                   }}/>
                        </label>
                        <label>SOURCE
                            <input type="number" min="0" step="0.01" value="0" aria-label="Region source offset"
                                   onInit={element => {
                                       sourceOffsetInput = element
                                       element.onchange = updateSelectedRegion
                                   }}/>
                        </label>
                    </div>
                    <div className="toolbar-spacer"/>
                    <label className="zoom-control">ZOOM
                        <input type="range" min="1" max="4" step="0.25" value="1" aria-label="Timeline zoom"
                               onInit={element => element.oninput = () => {
                                   waveformZoom = Number(element.value)
                                   timelineViewport.setZoom(waveformZoom)
                                   if (timelineContent !== undefined) {
                                       timelineContent.style.width = `${timelineViewport.contentWidthPercent()}%`
                                   }
                                   if (timelineViewport.snapshot().zoom === 1 && timelineScroll !== undefined) {
                                       timelineScroll.scrollLeft = 0
                                   }
                                   refreshTimelineLanes()
                                   const track = trackStore.selected()
                                   if (track !== undefined) drawWaveform(track)
                               }}/>
                    </label>
                    <span className="timeline-note">Audio track · Web Audio runtime</span>
                </div>
                <div className="timeline-canvas" onInit={element => {
                    element.onclick = event => {
                        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
                        const bounds = element.getBoundingClientRect()
                        seekFromInput(timelineViewport.secondsAtX(event.clientX - bounds.left, bounds.width).toString())
                    }
                }}>
                    <div className="ruler" aria-hidden="true">
                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
                    </div>
                    <div className="lane-grid">
                        <div className="lane-label">MAIN INPUT</div>
                        <div className="lane-track">
                            <div className="audio-drop-zone" onInit={element => {
                                element.ondragover = event => {
                                    event.preventDefault()
                                    element.classList.add("dragging")
                                }
                                element.ondragleave = () => element.classList.remove("dragging")
                                element.ondrop = event => {
                                    event.preventDefault()
                                    element.classList.remove("dragging")
                                    const file = event.dataTransfer?.files[0]
                                    if (file !== undefined) {
                                        void loadAudio(file)
                                    }
                                }
                            }}>
                                <div className="audio-drop-copy">
                                    <strong onInit={element => audioStatus = element}>Drop audio or choose a file</strong>
                                    <small onInit={element => audioMetadata = element}>WAV and browser-decodable audio</small>
                                </div>
                                <label className="file-button">LOAD AUDIO
                                    <input type="file" accept="audio/*" aria-label="Choose source audio"
                                           onInit={element => {
                                               fileInput = element
                                               element.onchange = () => {
                                                   const file = element.files?.[0]
                                                   if (file !== undefined) {
                                                       void loadAudio(file)
                                                   }
                                               }
                                           }}/>
                                </label>
                                <canvas className="waveform-canvas hidden" width="1200" height="160"
                                        aria-label="Source audio waveform"
                                        onInit={element => waveformCanvas = element}/>
                            </div>
                        </div>
                    </div>
                    <div className="timeline-scroll" onInit={element => {
                        timelineScroll = element
                        element.onscroll = () => {
                            const maximum = element.scrollWidth - element.clientWidth
                            timelineViewport.setScrollFraction(maximum > 0 ? element.scrollLeft / maximum : 0)
                            refreshTransport()
                        }
                    }}>
                        <div className="timeline-content" onInit={element => {
                            timelineContent = element
                            element.style.width = `${timelineViewport.contentWidthPercent()}%`
                        }}>
                            <div className="timeline-lane-list" onInit={element => timelineLaneList = element}/>
                        </div>
                    </div>
                    <div className="playhead" aria-hidden="true" onInit={element => playhead = element}/>
                    <input className="seek-slider" type="range" min="0" max={`${DEFAULT_TRANSPORT_DURATION_SECONDS}`}
                           step="0.01" value="0" aria-label="Seek timeline"
                           onInit={element => {
                               seekInput = element
                               element.oninput = () => seekFromInput(element.value)
                           }}/>
                </div>
            </section>
        </section>
        <section className="rack-panel" aria-label="Kahu rack">
            <div className="rack-heading">
                <div>
                    <span className="eyebrow">PROCESSING</span>
                    <h2 onInit={element => rackTitle = element}>Kahu Rack</h2>
                </div>
                <span className="rack-note">Audio effects only · reference lifecycle</span>
                <select className="module-picker" aria-label="Choose Kahu module" onInit={element => modulePicker = element}>
                    <option value="utility.gain">Gain</option>
                </select>
                <button className="rack-bypass-button" type="button" onInit={element => {
                    bypassAllButton = element
                    element.onclick = toggleBypassAll
                }}>BYPASS ALL</button>
                <button className="rack-add-button" type="button" onInit={element => {
                    addRackSlotButton = element
                    element.onclick = () => {
                        const track = trackStore.selected()
                        const moduleId = modulePicker?.value ?? "utility.gain"
                        const module = catalogModules.find(candidate => candidate.id === moduleId)
                        if (track !== undefined && module !== undefined) {
                            const defaults = Object.fromEntries(module.parameters.map(parameter => [parameter.key, parameter.default]))
                            const device = rackStore.addModule(track.id, module.id, module.name, defaults)
                            refreshRack()
                            void initializeRuntime(track.id, device.id, module.id)
                        }
                    }
                }}>ADD SLOT</button>
            </div>
            <div className="rack-chain" onInit={element => rackList = element}/>
        </section>
        <footer className="testbed-footer">
            <span>kahustack-dsp</span>
            <span className="runtime-info">{`${audioContext.sampleRate} Hz · 128 frame blocks`}</span>
            <label className="footer-trim">IN
                <input type="range" min="-24" max="12" step="0.1" value="0" aria-label="Input trim dB"
                       onInit={element => element.oninput = () => {
                           inputTrimDb = Number(element.value)
                           refreshTrackPlayers()
                       }}/>
            </label>
            <label className="footer-trim">OUT
                <input type="range" min="-24" max="12" step="0.1" value="0" aria-label="Output trim dB"
                       onInit={element => element.oninput = () => {
                           outputTrimDb = Number(element.value)
                           setOutputTrim()
                       }}/>
            </label>
            <button className={`compare-button${compareDry ? " active" : ""}`} type="button"
                    aria-label="Toggle dry comparison" onInit={element => element.onclick = () => {
                        compareDry = !compareDry
                        setMonitorComparison()
                        element.classList.toggle("active", compareDry)
                        element.textContent = compareDry ? "DRY" : "PROC"
                    }}>PROC</button>
            <canvas className="spectrum-canvas" width="96" height="16" aria-label="Output spectrum"
                    onInit={element => spectrumCanvas = element}/>
            <span className="output-meter" aria-label="Output meter">
                <span className="meter-fill" onInit={element => meterFill = element}/>
            </span>
            <span onInit={element => meterReadout = element}>-∞ dBFS</span>
        </footer>
    </main>
))

refreshTrackList()
updateSelectedTrack()
refreshRack()
refreshTimelineLanes()
refreshTransport()
void loadCatalog()
