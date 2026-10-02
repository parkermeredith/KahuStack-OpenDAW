import "./workbench.sass"
import "./timeline/timeline-navigation.sass"
import "./timeline/timeline-range-slider.sass"
import "./ui/opendaw-control.sass"
import {replaceChildren, createElement} from "@opendaw/lib-jsx"
import {Icon, IconLibrary} from "@opendaw/studio-icons"
import {IconSymbol, initializeColors} from "@opendaw/studio-enums"
import {tryCatch} from "@opendaw/lib-std"
import {TestbedShell} from "./shell"
import {DEFAULT_TRANSPORT_DURATION_SECONDS, Transport, TransportEpoch} from "./transport"
import {AudioTrackPlayer, decodeAudioFile} from "./audio-track"
import {buildWaveformPyramidAsync, extractVisibleWaveformPeaks, WaveformPyramid} from "./waveform"
import {TrackState, TrackStore} from "./track-store"
import {planRegionPlayback} from "./region"
import {TimelineController, TimelineFollowController} from "./timeline/timeline-controller"
import {attachWheelScroll} from "./timeline/wheel-scroll"
import {createTimelineNavigation} from "./timeline/timeline-navigation"
import {createTimelineRangeSlider} from "./timeline/timeline-range-slider"
import {projectRegionPixels, projectVisibleWaveform} from "./timeline/visible-waveform"
import {moveRangeForEdgePointer, RegionDragSession} from "./timeline/region-drag"
import {dispatchTransportShortcut} from "./timeline/transport-shortcuts"
import {createOpenDAWIconButton, createOpenDAWToggle, createOpenDAWValueControl, setOpenDAWToggleState} from "./ui/opendaw-button"
import {createKahuParameterKnob} from "./ui/kahu-parameter-knob"
import {RackStore} from "./rack-store"
import {effectiveBypass} from "./bypass-policy"
import {
    KahuDeviceRuntime,
    KahuModuleManifest,
    KahuParameterManifest,
    KahuRackDeviceRuntime,
    KahuRackRuntime,
    ReferenceDeviceRuntime,
    type KahuAnalysisTelemetry,
} from "./kahu-runtime"
import {editorKind, formatParameterValue} from "./parameter-editor"
import {
    createSession,
    decodeSession,
    encodeSession,
    LEGACY_SESSION_STORAGE_KEY,
    LEGACY_SESSION_V3_STORAGE_KEY,
    SESSION_STORAGE_KEY,
    type TestbedSession,
} from "./session-store"

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
const timelineController = new TimelineController()
const followController = new TimelineFollowController(timelineController.range)
const trackStore = new TrackStore()
const rackStore = new RackStore()
const audioPlayers = new Map<string, AudioTrackPlayer>()
const waveformPyramids = new Map<string, WaveformPyramid>()
const waveformBuilds = new Map<string, Promise<WaveformPyramid>>()
const kahuRuntimes = new Map<string, KahuDeviceRuntime>()
const rackHosts = new Map<string, KahuRackRuntime>()
const runtimeErrors = new Map<string, string>()
const minimizedRackDevices = new Set<string>()
const recoveredTrackIds = new Set<string>()
const CONSOLIDATED_RACK_RUNTIME = true

let pendingSession: TestbedSession | undefined
let catalogModules: ReadonlyArray<KahuModuleManifest> = []
let timeReadout: HTMLElement | undefined
let musicalReadout: HTMLElement | undefined
let playhead: HTMLElement | undefined
let positionInput: HTMLInputElement | undefined
let timelineStartInput: HTMLInputElement | undefined
let sourceOffsetInput: HTMLInputElement | undefined
let timelineViewport: HTMLElement | undefined
let trackTimelineRows: HTMLElement | undefined
let playButton: HTMLButtonElement | undefined
let loopButton: HTMLButtonElement | undefined
let followButton: HTMLButtonElement | undefined
let engineStatus: HTMLElement | undefined
let fileInput: HTMLInputElement | undefined
let rackList: HTMLElement | undefined
let rackTitle: HTMLElement | undefined
let rackPanel: HTMLElement | undefined
let rackCollapseButton: HTMLButtonElement | undefined
let addRackSlotButton: HTMLButtonElement | undefined
let modulePicker: HTMLSelectElement | undefined
let meterFill: HTMLElement | undefined
let meterReadout: HTMLElement | undefined
let bypassAllButton: HTMLButtonElement | undefined
let spectrumCanvas: HTMLCanvasElement | undefined
let bypassAll = false
let rackCollapsed = false
let compareDry = false
let inputTrimDb = 0
let outputTrimDb = 0
let analysisTrackId: string | undefined
let processedMomentaryLufs: number | null = null
let levelMatchGainDb = 0
let levelMatchAvailable = false
let kahuSpectrum: Float32Array | undefined
let kahuSpectrumBandCount = 0
let timeAxisUpdatePosition: ((positionSeconds: number) => void) | undefined
let activeRegionDrag: RegionDragSession | undefined
let activeRegionDragCleanup: (() => void) | undefined
let animationFrame = 0

const createPauseIcon = (): HTMLElement => {
    const icon = document.createElement("span")
    icon.className = "pause-glyph"
    icon.setAttribute("aria-hidden", "true")
    return icon
}

const setMonitorComparison = (): void => {
    const dryMatchGain = levelMatchAvailable ? 10 ** (levelMatchGainDb / 20) : 1
    dryCompare.gain.setValueAtTime(compareDry ? dryMatchGain : 0, audioContext.currentTime)
    processedCompare.gain.setValueAtTime(compareDry ? 0 : 1, audioContext.currentTime)
}

const setOutputTrim = (): void => {
    outputTrim.gain.setValueAtTime(10 ** (outputTrimDb / 20), audioContext.currentTime)
}

setMonitorComparison()
setOutputTrim()

const applyKahuAnalysis = (trackId: string, telemetry: KahuAnalysisTelemetry): void => {
    if (trackStore.selected()?.id !== trackId) return
    analysisTrackId = trackId
    processedMomentaryLufs = telemetry.processedMomentaryLufs
    const processed = telemetry.processedMomentaryLufs
    const dry = telemetry.dryMomentaryLufs
    levelMatchAvailable = processed !== null && dry !== null
    if (processed !== null && dry !== null) levelMatchGainDb = Math.min(24, Math.max(-24, processed - dry))
    kahuSpectrumBandCount = Math.min(telemetry.spectrumBandCount, telemetry.spectrum.length)
    kahuSpectrum = kahuSpectrumBandCount > 0 ? telemetry.spectrum : undefined
    setMonitorComparison()
    refreshMeter()
}

const saveSession = (): void => {
    const result = tryCatch(() => {
        const viewport = {min: timelineController.range.min, max: timelineController.range.max}
        localStorage.setItem(
            SESSION_STORAGE_KEY,
            encodeSession(createSession(trackStore.all(), rackStore, trackStore.selected()?.id, viewport, transport.loopState(), followController.enabled)),
        )
    })
    engineStatus?.replaceChildren(result.status === "success" ? "SESSION SAVED · SOURCE FILES LOCAL" : "SESSION SAVE FAILED")
}

const recoverSession = (): void => {
    const result = tryCatch(() => {
        const serialized = localStorage.getItem(SESSION_STORAGE_KEY)
            ?? localStorage.getItem(LEGACY_SESSION_V3_STORAGE_KEY)
            ?? localStorage.getItem(LEGACY_SESSION_STORAGE_KEY)
        if (serialized === null) return undefined
        return decodeSession(serialized)
    })
    if (result.status === "failure") {
        engineStatus?.replaceChildren("SESSION RECOVERY FAILED")
        return
    }
    const session = result.value
    if (session === undefined) {
        engineStatus?.replaceChildren("NO SAVED SESSION")
        return
    }
    pendingSession = session
    recoveredTrackIds.clear()
    timelineController.range.min = session.viewport.min
    timelineController.range.max = session.viewport.max
    transport.setLoop(session.loop.enabled, session.loop.startSeconds, session.loop.endSeconds)
    followController.restore(session.follow, transport.snapshot().positionSeconds)
    if (session.selectedTrackId !== undefined) trackStore.select(session.selectedTrackId)
    const recovery = rackStore.restoreRecoverable(session.rack)
    refreshRack()
    for (const track of trackStore.all()) {
        for (const device of rackStore.devicesFor(track.id)) {
            if (device.moduleId !== undefined) void initializeRuntime(track.id, device.id, device.moduleId)
        }
    }
    const skipped = recovery.skippedChains + recovery.skippedDevices
    const warning = skipped > 0 || recovery.errors.length > 0 ? ` · ${skipped} INVALID RACK ENTRIES SKIPPED` : ""
    engineStatus?.replaceChildren(`SESSION RECOVERED · RESELECT SOURCE AUDIO${warning}`)
}

const refreshTransport = (): void => {
    const snapshot = transport.snapshot()
    const loopEpoch = transport.consumeLoopEpoch()
    if (loopEpoch !== undefined) playAllPlayers(loopEpoch)
    followController.update(snapshot.positionSeconds, activeRegionDrag !== undefined)
    refreshMeter()
    timeReadout?.replaceChildren(snapshot.timecode)
    musicalReadout?.replaceChildren(snapshot.musicalPosition)
    timeAxisUpdatePosition?.(snapshot.positionSeconds)
    playButton?.replaceChildren(snapshot.isPlaying ? createPauseIcon() : Icon({symbol: IconSymbol.Play, className: "opendaw-button-icon"}))
    playButton?.setAttribute("aria-label", snapshot.isPlaying ? "Pause" : "Play")
    const playheadX = timelineController.positionX(snapshot.positionSeconds)
    playhead?.style.setProperty("left", `${playheadX}px`)
    playhead?.classList.toggle(
        "outside-range",
        snapshot.positionSeconds < timelineController.range.unitMin || snapshot.positionSeconds > timelineController.range.unitMax,
    )
    loopButton?.classList.toggle("active", snapshot.loop.enabled)
    loopButton?.setAttribute("aria-pressed", snapshot.loop.enabled ? "true" : "false")
    followButton?.classList.toggle("active", followController.enabled)
    followButton?.setAttribute("aria-pressed", followController.enabled ? "true" : "false")
    if (positionInput !== undefined && document.activeElement !== positionInput) {
        positionInput.value = snapshot.positionSeconds.toFixed(2)
        positionInput.max = snapshot.durationSeconds.toString()
    }
    if (snapshot.isPlaying) animationFrame = requestAnimationFrame(refreshTransport)
    else animationFrame = 0
}

const refreshMeter = (): void => {
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    let peak = 0
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
    const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity
    meterFill?.style.setProperty("width", `${Math.min(1, peak) * 100}%`)
    const peakReadout = Number.isFinite(db) ? `${db.toFixed(1)} dBFS` : "-∞ dBFS"
    meterReadout?.replaceChildren(processedMomentaryLufs === null
        ? peakReadout
        : `${processedMomentaryLufs.toFixed(1)} LUFS · A/B ${levelMatchAvailable ? `${levelMatchGainDb >= 0 ? "+" : ""}${levelMatchGainDb.toFixed(1)} dB` : "PENDING"}`)
    const canvas = spectrumCanvas
    const context = canvas?.getContext("2d")
    if (canvas === undefined || context === null || context === undefined) return
    const width = canvas.width = Math.max(1, Math.floor(canvas.clientWidth * Math.min(2, window.devicePixelRatio || 1)))
    const height = canvas.height = Math.max(1, Math.floor(canvas.clientHeight * Math.min(2, window.devicePixelRatio || 1)))
    context.clearRect(0, 0, width, height)
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-green")
    const barWidth = width / 24
    const frequencies = kahuSpectrum === undefined ? new Float32Array(analyser.frequencyBinCount) : undefined
    if (frequencies !== undefined) analyser.getFloatFrequencyData(frequencies)
    for (let bar = 0; bar < 24; bar++) {
        const normalized = kahuSpectrum !== undefined && kahuSpectrumBandCount > 0
            ? (() => {
                const index = Math.min(kahuSpectrumBandCount - 1, Math.floor((bar / 24) ** 1.35 * kahuSpectrumBandCount))
                const power = Math.max(1e-12, kahuSpectrum?.[index] ?? 0)
                return Math.max(0, Math.min(1, (10 * Math.log10(power) + 96) / 96))
            })()
            : (() => {
                const spectrum = frequencies ?? new Float32Array()
                const index = Math.min(Math.max(0, spectrum.length - 1), Math.floor((bar / 24) ** 1.8 * spectrum.length))
                return Math.max(0, Math.min(1, ((spectrum[index] ?? -96) + 96) / 96))
            })()
        context.fillRect(bar * barWidth, height * (1 - normalized), Math.max(1, barWidth - 1), height * normalized)
    }
}

const restartTransportRefresh = (): void => {
    if (animationFrame !== 0) cancelAnimationFrame(animationFrame)
    refreshTransport()
}

const seekFromInput = (value: string): void => {
    const position = Number(value)
    const epoch = transport.seek(position)
    if (epoch !== undefined) playAllPlayers(epoch)
    else for (const player of audioPlayers.values()) player.seek(position)
    restartTransportRefresh()
}

const drawRegionWaveform = (track: TrackState, region: HTMLElement, canvas: HTMLCanvasElement): void => {
    const pyramid = waveformPyramids.get(track.id)
    const visible = projectVisibleWaveform(timelineController.range, track.region, track.audio.sampleRate)
    if (pyramid === undefined || visible === undefined) {
        canvas.classList.add("hidden")
        return
    }
    const full = projectRegionPixels(timelineController.range, track.region.timelineStartSeconds, track.region.durationSeconds)
    const logicalWidth = Math.max(1, visible.rightPixels - visible.leftPixels)
    const logicalHeight = Math.max(1, region.clientHeight)
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1))
    const physicalWidth = Math.max(1, Math.ceil(logicalWidth * dpr))
    const physicalHeight = Math.max(1, Math.ceil(logicalHeight * dpr))
    canvas.classList.remove("hidden")
    canvas.style.left = `${visible.leftPixels - full.leftPixels}px`
    canvas.style.width = `${logicalWidth}px`
    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth
        canvas.height = physicalHeight
    }
    const context = canvas.getContext("2d")
    if (context === null) return
    context.clearRect(0, 0, physicalWidth, physicalHeight)
    const peaks = extractVisibleWaveformPeaks(
        pyramid,
        visible.sourceStartSamples,
        visible.sourceEndSamples,
        physicalWidth,
    )
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-green")
    context.globalAlpha = 0.88
    const midpoint = physicalHeight / 2
    for (let column = 0; column < peaks.minimum.length; column++) {
        const top = midpoint - peaks.maximum[column] * midpoint * 0.88
        const bottom = midpoint - peaks.minimum[column] * midpoint * 0.88
        context.fillRect(column, top, 1, Math.max(1, bottom - top))
    }
    context.globalAlpha = 1
}

const ensureWaveformPyramid = (track: TrackState): void => {
    if (waveformPyramids.has(track.id) || waveformBuilds.has(track.id)) return
    const build = buildWaveformPyramidAsync(track.audio.buffer.getChannelData(0))
    waveformBuilds.set(track.id, build)
    void build.then(pyramid => {
        waveformBuilds.delete(track.id)
        waveformPyramids.set(track.id, pyramid)
        refreshTrackRows()
    }).catch(() => {
        waveformBuilds.delete(track.id)
        engineStatus?.replaceChildren(`WAVEFORM BUILD FAILED · ${track.name}`)
    })
}

const applyTrackGain = (track: TrackState): void => {
    const player = audioPlayers.get(track.id)
    player?.setGain(trackStore.isAudible(track) ? track.gain : 0)
    player?.setPan(track.pan)
    player?.setInputTrim(10 ** (inputTrimDb / 20))
}

const refreshTrackPlayers = (): void => {
    for (const track of trackStore.all()) applyTrackGain(track)
}

const refreshTrackDuration = (): void => {
    const duration = trackStore.durationSeconds()
    timelineController.setDuration(duration > 0 ? duration : DEFAULT_TRANSPORT_DURATION_SECONDS)
    if (timelineViewport !== undefined) timelineController.setWidth(timelineViewport.clientWidth)
    updateTimelineRegionGeometry()
    restartTransportRefresh()
}

const updateTimelineRegionGeometry = (): void => {
    const root = trackTimelineRows
    if (root === undefined) return
    for (const region of root.querySelectorAll<HTMLElement>(".timeline-region")) {
        const track = trackStore.all().find(candidate => candidate.id === region.dataset.trackId)
        if (track === undefined) continue
        const geometry = projectRegionPixels(timelineController.range, track.region.timelineStartSeconds, track.region.durationSeconds)
        region.style.left = `${geometry.leftPixels}px`
        region.style.width = `${geometry.widthPixels}px`
        const canvas = region.querySelector<HTMLCanvasElement>(".timeline-region-waveform")
        if (canvas !== null) drawRegionWaveform(track, region, canvas)
    }
}

const updateSelectedTrack = (): void => {
    const track = trackStore.selected()
    if (analysisTrackId !== track?.id) {
        analysisTrackId = track?.id
        processedMomentaryLufs = null
        levelMatchGainDb = 0
        levelMatchAvailable = false
        kahuSpectrum = undefined
        kahuSpectrumBandCount = 0
        setMonitorComparison()
    }
    if (track === undefined) {
        if (timelineStartInput !== undefined) timelineStartInput.value = "0"
        if (sourceOffsetInput !== undefined) sourceOffsetInput.value = "0"
        return
    }
    if (timelineStartInput !== undefined) timelineStartInput.value = track.region.timelineStartSeconds.toFixed(2)
    if (sourceOffsetInput !== undefined) {
        sourceOffsetInput.value = track.region.sourceOffsetSeconds.toFixed(2)
        sourceOffsetInput.max = track.audio.durationSeconds.toString()
    }
    ensureWaveformPyramid(track)
}

const syncTrackSelectionClasses = (): void => {
    const selected = trackStore.selected()?.id
    for (const row of trackTimelineRows?.querySelectorAll<HTMLElement>(".track-workspace-row") ?? []) {
        row.classList.toggle("selected", row.dataset.trackId === selected)
    }
}

const selectTrack = (trackId: string, rebuild = true): void => {
    trackStore.select(trackId)
    updateSelectedTrack()
    refreshRack()
    if (rebuild) refreshTrackRows()
    else syncTrackSelectionClasses()
}

const finishRegionDrag = (approve: boolean): void => {
    const drag = activeRegionDrag
    if (drag === undefined) return
    if (approve) drag.approve()
    else drag.cancel()
    activeRegionDragCleanup?.()
    activeRegionDragCleanup = undefined
    activeRegionDrag = undefined
    refreshTrackRows()
    refreshTrackDuration()
    updateSelectedTrack()
    const epoch = transport.reschedule()
    if (epoch !== undefined) playAllPlayers(epoch)
}

const createTrackControls = (track: TrackState): HTMLElement => {
    const cell = document.createElement("div")
    cell.className = "track-row"
    cell.onclick = () => selectTrack(track.id)
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
    const mute = createOpenDAWToggle({
        symbol: IconSymbol.Mute,
        label: "Mute track",
        active: track.muted,
        className: "track-action",
        onChange: (_active, event) => {
            event.stopPropagation()
            trackStore.setMuted(track.id, !track.muted)
            refreshTrackPlayers()
            refreshTrackRows()
        },
    })
    const solo = createOpenDAWToggle({
        symbol: IconSymbol.Solo,
        label: "Solo track",
        active: track.solo,
        className: "track-action",
        onChange: (_active, event) => {
            event.stopPropagation()
            trackStore.setSolo(track.id, !track.solo)
            refreshTrackPlayers()
            refreshTrackRows()
        },
    })
    const remove = createOpenDAWIconButton({
        symbol: IconSymbol.Close,
        label: "Remove track",
        className: "track-action remove",
        onClick: event => {
            event.stopPropagation()
            removeTrack(track.id)
        },
    })
    actions.append(mute, solo, remove)
    const gain = createOpenDAWValueControl({
        min: 0,
        max: 1,
        step: 0.01,
        getValue: () => track.gain,
        setValue: value => {
            trackStore.setGain(track.id, value)
            applyTrackGain(track)
        },
        formatValue: value => `${Math.round(value * 100)}%`,
        label: `${track.name} gain`,
        className: "track-gain",
    })
    gain.onclick = event => event.stopPropagation()
    const pan = createOpenDAWValueControl({
        min: -1,
        max: 1,
        step: 0.01,
        getValue: () => track.pan,
        setValue: value => {
            trackStore.setPan(track.id, value)
            applyTrackGain(track)
        },
        formatValue: value => {
            const amount = Math.round(Math.abs(value) * 100)
            return amount === 0 ? "C" : `${value < 0 ? "L" : "R"}${amount}`
        },
        label: `${track.name} pan`,
        className: "track-gain track-pan",
    })
    pan.onclick = event => event.stopPropagation()
    cell.append(color, info, actions, gain, pan)
    return cell
}

const createTimelineLane = (track: TrackState): HTMLElement => {
    const lane = document.createElement("div")
    lane.className = "timeline-track-lane"
    const area = document.createElement("div")
    area.className = "timeline-track-area"
    attachWheelScroll(area, timelineController.range)
    area.onclick = event => {
        if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement) return
        const bounds = area.getBoundingClientRect()
        seekFromInput(timelineController.secondsAtX(event.clientX - bounds.left, bounds.width).toString())
    }
    const region = document.createElement("button")
    region.type = "button"
    region.className = "timeline-region"
    region.dataset.trackId = track.id
    const geometry = projectRegionPixels(timelineController.range, track.region.timelineStartSeconds, track.region.durationSeconds)
    region.style.left = `${geometry.leftPixels}px`
    region.style.width = `${geometry.widthPixels}px`
    const waveform = document.createElement("canvas")
    waveform.className = "timeline-region-waveform hidden"
    waveform.setAttribute("aria-hidden", "true")
    const label = document.createElement("span")
    label.className = "timeline-region-label"
    label.textContent = `${track.name} · ${track.audio.durationSeconds.toFixed(1)} s`
    region.append(waveform, label)
    region.onclick = event => {
        event.stopPropagation()
        selectTrack(track.id)
    }
    region.onpointerdown = event => {
        if (event.button !== 0) return
        event.preventDefault()
        event.stopPropagation()
        selectTrack(track.id, false)
        const drag = new RegionDragSession(timelineController.range, track.region, event.clientX - area.getBoundingClientRect().left)
        activeRegionDrag = drag
        region.setPointerCapture(event.pointerId)
        const move = (moveEvent: PointerEvent): void => {
            moveRangeForEdgePointer(timelineController.range, moveEvent.clientX, area.getBoundingClientRect())
            drag.update(moveEvent.clientX - area.getBoundingClientRect().left)
            updateTimelineRegionGeometry()
        }
        const up = (upEvent: PointerEvent): void => {
            if (upEvent.pointerId === event.pointerId) finishRegionDrag(true)
        }
        const cancel = (): void => finishRegionDrag(false)
        const escape = (keyEvent: KeyboardEvent): void => {
            if (keyEvent.key === "Escape") cancel()
        }
        region.addEventListener("pointermove", move)
        region.addEventListener("pointerup", up)
        region.addEventListener("pointercancel", cancel)
        window.addEventListener("keydown", escape)
        activeRegionDragCleanup = () => {
            region.removeEventListener("pointermove", move)
            region.removeEventListener("pointerup", up)
            region.removeEventListener("pointercancel", cancel)
            window.removeEventListener("keydown", escape)
        }
    }
    area.append(region)
    lane.append(area)
    queueMicrotask(() => drawRegionWaveform(track, region, waveform))
    return lane
}

const createEmptyTimeline = (): HTMLElement => {
    const row = document.createElement("div")
    row.className = "track-timeline-empty"
    const rail = document.createElement("div")
    rail.className = "track-empty-rail"
    rail.textContent = "No active tracks"
    const drop = document.createElement("div")
    drop.className = "audio-empty-state"
    const copy = document.createElement("div")
    copy.className = "audio-empty-copy"
    const title = document.createElement("strong")
    title.textContent = "Drop audio here"
    const hint = document.createElement("small")
    hint.textContent = "or use + to add a browser-decodable audio track"
    copy.append(title, hint)
    const load = document.createElement("button")
    load.type = "button"
    load.className = "file-button"
    load.textContent = "ADD AUDIO"
    load.onclick = () => fileInput?.click()
    drop.ondragover = event => {
        event.preventDefault()
        drop.classList.add("dragging")
    }
    drop.ondragleave = () => drop.classList.remove("dragging")
    drop.ondrop = event => {
        event.preventDefault()
        drop.classList.remove("dragging")
        const file = event.dataTransfer?.files[0]
        if (file !== undefined) void loadAudio(file)
    }
    attachWheelScroll(drop, timelineController.range)
    drop.append(copy, load)
    row.append(rail, drop)
    return row
}

const refreshTrackRows = (): void => {
    const root = trackTimelineRows
    if (root === undefined || activeRegionDrag !== undefined) return
    root.replaceChildren()
    const tracks = trackStore.all()
    if (tracks.length === 0) {
        root.append(createEmptyTimeline())
        return
    }
    for (const track of tracks) {
        const row = document.createElement("div")
        row.className = `track-workspace-row${trackStore.selected() === track ? " selected" : ""}`
        row.dataset.trackId = track.id
        row.append(createTrackControls(track), createTimelineLane(track))
        root.append(row)
        ensureWaveformPyramid(track)
    }
    queueMicrotask(updateTimelineRegionGeometry)
}

const removeTrack = (id: string): void => {
    audioPlayers.get(id)?.stop()
    audioPlayers.delete(id)
    waveformPyramids.delete(id)
    waveformBuilds.delete(id)
    for (const device of rackStore.devicesFor(id)) {
        kahuRuntimes.get(device.id)?.dispose()
        kahuRuntimes.delete(device.id)
        runtimeErrors.delete(device.id)
        minimizedRackDevices.delete(device.id)
    }
    rackHosts.get(id)?.dispose()
    rackHosts.delete(id)
    trackStore.remove(id)
    rackStore.removeTrack(id)
    refreshTrackRows()
    updateSelectedTrack()
    refreshTrackDuration()
    refreshRack()
}

const rebuildTrackRack = (trackId: string): void => {
    const player = audioPlayers.get(trackId)
    if (player === undefined) return
    const runtimes = rackStore.devicesFor(trackId)
        .map(device => kahuRuntimes.get(device.id))
        .filter((runtime): runtime is KahuDeviceRuntime => runtime !== undefined)
    if (CONSOLIDATED_RACK_RUNTIME) {
        const rack = rackHosts.get(trackId)
        if (rack !== undefined) {
            rack.connectOutput(monitorInput)
            player.setComparisonOutputs(rack.input, dryMonitor)
        } else player.setOutput(dryMonitor)
        return
    }
    for (let index = 0; index < runtimes.length; index++) runtimes[index].connectOutput(runtimes[index + 1]?.output ?? monitorInput)
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
    const value = (): number => runtime?.parameterValue(parameter.key) ?? deviceValues[parameter.key] ?? parameter.default
    const updateValue = (next: number): void => {
        rackStore.setParameter(track.id, deviceId, parameter.key, next)
        if (runtime === undefined) return
        if (parameter.automation === "reprepare") {
            engineStatus?.replaceChildren("RUST/WASM ENGINE · REPREPARE")
            void initializeRuntime(track.id, deviceId, deviceModuleId ?? runtime.moduleId)
        } else runtime.setParameter(parameter.key, next)
    }
    const kind = editorKind(parameter)
    if (kind !== "boolean" && kind !== "enum") {
        return createKahuParameterKnob({parameter, getValue: value, setValue: updateValue, disabled: runtime === undefined})
    }
    const cell = document.createElement("div")
    cell.className = `rack-parameter-cell rack-parameter-${kind}`
    cell.dataset.automation = parameter.automation
    const label = document.createElement("span")
    label.className = "rack-parameter-label"
    label.textContent = parameter.name
    const readout = document.createElement("small")
    readout.textContent = formatParameterValue(parameter, value())
    if (kind === "boolean") {
        const control = createOpenDAWToggle({
            symbol: IconSymbol.Checkbox,
            label: parameter.name,
            active: value() >= 0.5,
            className: "rack-parameter-toggle",
            disabled: runtime === undefined,
            onChange: active => {
                const next = active ? parameter.max : parameter.min
                readout.textContent = formatParameterValue(parameter, next)
                updateValue(next)
            },
        })
        cell.append(label, control, readout)
        return cell
    }
    const control = document.createElement("select")
    control.className = "rack-parameter-select"
    control.disabled = runtime === undefined
    for (const [index, optionLabel] of (parameter.enum_values ?? []).entries()) {
        const option = document.createElement("option")
        option.value = (parameter.min + index * parameter.step).toString()
        option.textContent = optionLabel
        control.append(option)
    }
    control.value = value().toString()
    control.onchange = () => {
        const next = Number(control.value)
        readout.textContent = formatParameterValue(parameter, next)
        updateValue(next)
    }
    cell.append(label, control, readout)
    return cell
}

const deviceStatus = (deviceId: string, bypassed: boolean, moduleUnavailable: boolean, runtime: KahuDeviceRuntime | undefined): string => {
    if (bypassed) return "BYPASSED"
    if (runtimeErrors.has(deviceId)) return "RUNTIME ERROR"
    if (moduleUnavailable) return "MODULE UNAVAILABLE"
    return runtime === undefined ? "RUNTIME PENDING" : "RUST/WASM ACTIVE"
}

const refreshRack = (): void => {
    const root = rackList
    if (root === undefined) return
    root.replaceChildren()
    const track = trackStore.selected()
    if (track === undefined) {
        rackTitle?.replaceChildren("Kahu Rack")
        if (addRackSlotButton !== undefined) addRackSlotButton.disabled = true
        const empty = document.createElement("div")
        empty.className = "rack-empty"
        empty.textContent = "Select an audio track to view its effect chain."
        root.append(empty)
        return
    }
    rackTitle?.replaceChildren(`Kahu Rack · ${track.name}`)
    if (addRackSlotButton !== undefined) addRackSlotButton.disabled = false
    const devices = rackStore.devicesFor(track.id)
    if (devices.length === 0) {
        const empty = document.createElement("div")
        empty.className = "rack-empty"
        const title = document.createElement("strong")
        title.textContent = "Empty audio-effect chain"
        const hint = document.createElement("span")
        hint.textContent = "Choose a Kahu module and add it to this track."
        empty.append(title, hint)
        root.append(empty)
        return
    }
    for (const [index, device] of devices.entries()) {
        const runtime = kahuRuntimes.get(device.id)
        const module = catalogModules.find(candidate => candidate.id === device.moduleId)
        const moduleUnavailable = device.moduleId !== undefined && module === undefined
        const minimized = minimizedRackDevices.has(device.id)
        const card = document.createElement("article")
        card.className = `rack-device${device.bypassed ? " bypassed" : ""}${minimized ? " minimized" : ""}`
        card.dataset.deviceId = device.id
        const header = document.createElement("header")
        header.className = "rack-device-header"
        const collapse = createOpenDAWIconButton({
            symbol: minimized ? IconSymbol.Maximized : IconSymbol.Minimized,
            label: minimized ? "Expand processor" : "Minimize processor",
            className: "rack-device-collapse",
            onClick: () => {
                if (minimized) minimizedRackDevices.delete(device.id)
                else minimizedRackDevices.add(device.id)
                refreshRack()
            },
        })
        const power = createOpenDAWToggle({
            symbol: IconSymbol.Shutdown,
            label: device.bypassed ? "Enable processor" : "Bypass processor",
            active: !device.bypassed,
            className: "rack-device-power",
            onChange: enabled => {
                const deviceBypassed = !enabled
                rackStore.setBypassed(track.id, device.id, deviceBypassed)
                kahuRuntimes.get(device.id)?.setBypassed(effectiveBypass(bypassAll, deviceBypassed))
                refreshRack()
            },
        })
        const title = document.createElement("strong")
        title.className = "rack-device-title"
        title.textContent = runtime?.name ?? device.name
        title.title = runtime === undefined ? device.name : `${runtime.name} · ${runtime.moduleId}`
        const status = document.createElement("small")
        status.className = "rack-device-status"
        status.textContent = deviceStatus(device.id, device.bypassed, moduleUnavailable, runtime)
        header.append(collapse, power, title, status)
        if (!minimized) {
            const actions = document.createElement("div")
            actions.className = "rack-device-actions"
            if (runtime !== undefined) {
                actions.append(createOpenDAWIconButton({
                    symbol: IconSymbol.Undo,
                    label: "Reset processor",
                    className: "rack-control",
                    onClick: () => runtime.reset(),
                }))
            }
            actions.append(
                createOpenDAWIconButton({
                    symbol: IconSymbol.ArrowLeft,
                    label: "Move processor left",
                    className: "rack-control",
                    disabled: index === 0,
                    onClick: () => {
                        rackStore.move(track.id, device.id, -1)
                        if (runtime instanceof KahuRackDeviceRuntime) void runtime.move(-1)
                        rebuildTrackRack(track.id)
                        refreshRack()
                    },
                }),
                createOpenDAWIconButton({
                    symbol: IconSymbol.ArrowRight,
                    label: "Move processor right",
                    className: "rack-control",
                    disabled: index === devices.length - 1,
                    onClick: () => {
                        rackStore.move(track.id, device.id, 1)
                        if (runtime instanceof KahuRackDeviceRuntime) void runtime.move(1)
                        rebuildTrackRack(track.id)
                        refreshRack()
                    },
                }),
                createOpenDAWIconButton({
                    symbol: IconSymbol.Close,
                    label: "Remove processor",
                    className: "rack-control remove",
                    onClick: () => {
                        kahuRuntimes.get(device.id)?.dispose()
                        kahuRuntimes.delete(device.id)
                        runtimeErrors.delete(device.id)
                        minimizedRackDevices.delete(device.id)
                        rackStore.remove(track.id, device.id)
                        rebuildTrackRack(track.id)
                        refreshRack()
                    },
                }),
            )
            header.append(actions)
        }
        card.append(header)
        if (minimized) {
            root.append(card)
            continue
        }
        const meta = document.createElement("div")
        meta.className = "rack-device-meta"
        meta.textContent = runtime === undefined
            ? runtimeErrors.get(device.id) ?? (moduleUnavailable ? `No staged catalog entry for ${device.moduleId}` : "Waiting for Kahu runtime")
            : `${runtime.moduleId} · ${runtime.latency} sample latency`
        const parameters = runtime?.parameters ?? module?.parameters ?? []
        const parameterGrid = document.createElement("div")
        parameterGrid.className = "rack-parameter-grid"
        for (const parameter of parameters) {
            parameterGrid.append(parameterEditor(track, device.id, device.moduleId, device.parameterValues, runtime, parameter))
        }
        if (parameters.length === 0) {
            const empty = document.createElement("span")
            empty.className = "rack-parameter-empty"
            empty.textContent = "No exposed parameters"
            parameterGrid.append(empty)
        }
        card.append(meta, parameterGrid)
        root.append(card)
    }
}

const initializeRuntime = async (trackId: string, deviceId: string, moduleId: string): Promise<void> => {
    const player = audioPlayers.get(trackId)
    if (player === undefined) return
    engineStatus?.replaceChildren("RUST/WASM ENGINE · LOADING")
    const create = async (): Promise<KahuDeviceRuntime> => {
        if (!CONSOLIDATED_RACK_RUNTIME) return ReferenceDeviceRuntime.create(audioContext, 2, 128, moduleId)
        let rack = rackHosts.get(trackId)
        if (rack === undefined) {
            rack = await KahuRackRuntime.create(audioContext, 2, 128)
            rack.setAnalysisHandler(telemetry => applyKahuAnalysis(trackId, telemetry))
            rackHosts.set(trackId, rack)
        }
        const module = catalogModules.find(candidate => candidate.id === moduleId)
        if (module === undefined) throw new Error(`Generated Kahu manifest does not contain ${moduleId}.`)
        kahuRuntimes.get(deviceId)?.dispose()
        return rack.addDevice(module)
    }
    await create().then(runtime => {
        kahuRuntimes.get(deviceId)?.dispose()
        kahuRuntimes.set(deviceId, runtime)
        runtime.setAnalysisHandler(telemetry => applyKahuAnalysis(trackId, telemetry))
        runtime.setErrorHandler(message => {
            runtimeErrors.set(deviceId, message)
            engineStatus?.replaceChildren("RUST/WASM ENGINE · ERROR")
            refreshRack()
        })
        rebuildTrackRack(trackId)
        const device = rackStore.devicesFor(trackId).find(candidate => candidate.id === deviceId)
        for (const parameter of runtime.parameters) runtime.setParameter(parameter.key, device?.parameterValues[parameter.key] ?? parameter.default)
        runtime.setBypassed(effectiveBypass(bypassAll, device?.bypassed ?? false))
        runtimeErrors.delete(deviceId)
        engineStatus?.replaceChildren("RUST/WASM ENGINE · READY")
        refreshRack()
    }).catch(error => {
        runtimeErrors.set(deviceId, error instanceof Error ? error.message : "Kahu runtime initialization failed.")
        engineStatus?.replaceChildren("RUST/WASM ENGINE · UNAVAILABLE")
        refreshRack()
    })
}

const toggleBypassAll = (): void => {
    bypassAll = !bypassAll
    for (const track of trackStore.all()) {
        for (const device of rackStore.devicesFor(track.id)) {
            kahuRuntimes.get(device.id)?.setBypassed(effectiveBypass(bypassAll, device.bypassed))
        }
    }
    if (bypassAllButton === undefined) return
    setOpenDAWToggleState(bypassAllButton, bypassAll)
    bypassAllButton.replaceChildren(Icon({symbol: IconSymbol.Exclude, className: "opendaw-button-icon"}))
}

const applyRackCollapsedState = (): void => {
    rackPanel?.classList.toggle("collapsed", rackCollapsed)
    if (rackCollapseButton === undefined) return
    rackCollapseButton.replaceChildren(Icon({
        symbol: rackCollapsed ? IconSymbol.Maximized : IconSymbol.Minimized,
        className: "opendaw-button-icon",
    }))
    rackCollapseButton.setAttribute("aria-label", rackCollapsed ? "Expand processing rack" : "Collapse processing rack")
    rackCollapseButton.setAttribute("aria-expanded", rackCollapsed ? "false" : "true")
}

const toggleRackCollapsed = (): void => {
    rackCollapsed = !rackCollapsed
    applyRackCollapsedState()
}

const handleAudioEnded = (): void => {
    if (transport.snapshot().isPlaying && !Array.from(audioPlayers.values()).some(player => player.isPlaying())) {
        transport.stop()
        restartTransportRefresh()
    }
}

const stopAllPlayers = (): void => {
    for (const player of audioPlayers.values()) player.stop()
}

const pauseAllPlayers = (positionSeconds: number): void => {
    for (const player of audioPlayers.values()) player.pauseAt(positionSeconds)
}

const playAllPlayers = (epoch: TransportEpoch): void => {
    for (const track of trackStore.all()) {
        const player = audioPlayers.get(track.id)
        if (player === undefined) continue
        applyTrackGain(track)
        const plan = planRegionPlayback(track.region, epoch.positionSeconds, track.audio.durationSeconds)
        if (plan === undefined) player.stop()
        else player.playAt(epoch.startTimeSeconds + plan.delaySeconds, plan.sourceOffsetSeconds, plan.durationSeconds)
    }
}

const updateSelectedRegion = (): void => {
    const track = trackStore.selected()
    if (track === undefined) return
    trackStore.setRegionTiming(track.id, Number(timelineStartInput?.value ?? 0), Number(sourceOffsetInput?.value ?? 0))
    refreshTrackDuration()
    updateSelectedTrack()
    updateTimelineRegionGeometry()
    const epoch = transport.reschedule()
    if (epoch !== undefined) playAllPlayers(epoch)
}

const loadAudio = async (file: File): Promise<void> => {
    await decodeAudioFile(audioContext, file).then(track => {
        const wasPlaying = transport.snapshot().isPlaying
        const restored = pendingSession?.tracks.find(candidate => !recoveredTrackIds.has(candidate.id)
            && candidate.fileName.toLocaleLowerCase() === file.name.toLocaleLowerCase())
        const state = trackStore.add(track, restored)
        if (restored !== undefined) {
            recoveredTrackIds.add(restored.id)
            if (pendingSession?.selectedTrackId === restored.id) trackStore.select(restored.id)
        }
        const player = new AudioTrackPlayer(audioContext, handleAudioEnded)
        player.load(track.buffer)
        audioPlayers.set(state.id, player)
        applyTrackGain(state)
        rebuildTrackRack(state.id)
        refreshTrackRows()
        updateSelectedTrack()
        refreshTrackDuration()
        refreshRack()
        if (pendingSession !== undefined) transport.setLoop(pendingSession.loop.enabled, pendingSession.loop.startSeconds, pendingSession.loop.endSeconds)
        for (const device of rackStore.devicesFor(state.id)) {
            if (device.moduleId !== undefined) void initializeRuntime(state.id, device.id, device.moduleId)
        }
        const pendingSources = pendingSession?.tracks.length ?? 0
        if (pendingSources > 0 && recoveredTrackIds.size >= pendingSources) engineStatus?.replaceChildren("SESSION SOURCES RESTORED")
        if (wasPlaying) {
            const epoch = transport.reschedule()
            if (epoch !== undefined) playAllPlayers(epoch)
        }
        restartTransportRefresh()
    }).catch(() => engineStatus?.replaceChildren(`UNABLE TO DECODE · ${file.name}`))
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

const stopTransport = (): void => {
    stopAllPlayers()
    transport.stop()
    restartTransportRefresh()
}

const moveTransportPosition = (direction: -1 | 1): void => {
    const position = transport.snapshot().positionSeconds
    const amount = Math.max(0.01, timelineController.range.unitRange / 100)
    const epoch = transport.seek(position + direction * amount)
    if (epoch !== undefined) playAllPlayers(epoch)
    restartTransportRefresh()
}

const toggleLoop = (): void => {
    transport.toggleLoop()
    restartTransportRefresh()
}

const toggleFollow = (): void => {
    const position = transport.snapshot().positionSeconds
    followController.setEnabled(!followController.enabled, position)
    restartTransportRefresh()
}

const loadCatalog = async (): Promise<void> => {
    await ReferenceDeviceRuntime.catalog().then(catalog => {
        catalogModules = catalog.modules
        if (modulePicker === undefined) return
        const placeholder = document.createElement("option")
        placeholder.value = ""
        placeholder.textContent = "Choose module"
        modulePicker.replaceChildren(placeholder)
        const groups = new Map<string, KahuModuleManifest[]>()
        for (const module of catalogModules) {
            const groupName = `${module.domain.toUpperCase()}${module.family.startsWith("experimental-") ? " · EXPERIMENTAL" : ""}`
            const group = groups.get(groupName)
            if (group === undefined) groups.set(groupName, [module])
            else group.push(module)
        }
        for (const [groupName, modules] of [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))) {
            const group = document.createElement("optgroup")
            group.label = groupName
            for (const module of modules.sort((left, right) => left.name.localeCompare(right.name))) {
                const option = document.createElement("option")
                option.value = module.id
                option.textContent = module.name
                group.append(option)
            }
            modulePicker.append(group)
        }
    }).catch(() => {
        catalogModules = []
        engineStatus?.replaceChildren("RUST/WASM CATALOG · UNAVAILABLE")
    })
}

replaceChildren(document.body, IconLibrary(), (
    <main className="testbed-shell">
        <header className="testbed-header">
            <div className="brand-lockup">
                <span className="brand-mark" aria-hidden="true">K</span>
                <div><h1>KahuStack DSP</h1><p>OpenDAW Testbed</p></div>
            </div>
            <div className="header-divider" aria-hidden="true"/>
            <span className="phase-label">{TestbedShell.phase}</span>
            <div className="header-spacer"/>
            <span className="engine-status" onInit={element => engineStatus = element}>{TestbedShell.engineStatus}</span>
            <button className="header-button" type="button" onInit={element => element.onclick = saveSession}>SAVE</button>
            <button className="header-button" type="button" onInit={element => element.onclick = recoverSession}>RECOVER</button>
            <button className="header-button" type="button" disabled aria-label="Settings are not connected yet">SETUP</button>
        </header>
        <section className="workspace" aria-label="KahuStack DSP testbed workspace">
            <section className="timeline-panel" aria-label="Timeline">
                <div className="timeline-header-grid">
                    <div className="panel-heading track-column-heading">
                        <span>TRACKS</span>
                        <button className="icon-button" type="button" aria-label="Add track" onInit={element => {
                            element.replaceChildren(Icon({symbol: IconSymbol.Add, className: "opendaw-button-icon"}))
                            element.onclick = () => fileInput?.click()
                        }}/>
                        <input className="hidden" type="file" accept="audio/*" aria-label="Choose source audio" onInit={element => {
                            fileInput = element
                            element.onchange = () => {
                                const file = element.files?.[0]
                                if (file !== undefined) void loadAudio(file)
                                element.value = ""
                            }
                        }}/>
                    </div>
                    <div className="timeline-toolbar">
                        <div className="transport-controls">
                            <button className="transport-button" type="button" aria-label="Play" onInit={element => {
                                playButton = element
                                element.onclick = () => {void toggleTransport()}
                            }}><Icon symbol={IconSymbol.Play} className="opendaw-button-icon"/></button>
                            <button className="stop-button" type="button" aria-label="Stop" onInit={element => {
                                element.onclick = stopTransport
                            }}><Icon symbol={IconSymbol.Stop} className="opendaw-button-icon"/></button>
                        </div>
                        <div className="transport-options" aria-label="Transport options">
                            <button className="transport-toggle-button" type="button" aria-label="Toggle loop" aria-pressed="false" onInit={element => {
                                loopButton = element
                                element.onclick = toggleLoop
                            }}><Icon symbol={IconSymbol.Loop} className="opendaw-button-icon"/></button>
                            <button className="transport-toggle-button" type="button" aria-label="Toggle timeline follow" aria-pressed="false" onInit={element => {
                                followButton = element
                                element.onclick = toggleFollow
                            }}><Icon symbol={IconSymbol.Focus} className="opendaw-button-icon"/></button>
                        </div>
                        <div className="time-readout">
                            <span onInit={element => timeReadout = element}>00:00:00</span>
                            <span className="musical-readout" onInit={element => musicalReadout = element}>1.1</span>
                        </div>
                        <input className="position-input" type="number" min="0" max={`${DEFAULT_TRANSPORT_DURATION_SECONDS}`} step="0.01" value="0"
                               aria-label="Seek position in seconds" onInit={element => {
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
                            <label>START<input type="number" min="0" step="0.01" value="0" aria-label="Region timeline start" onInit={element => {
                                timelineStartInput = element
                                element.onchange = updateSelectedRegion
                            }}/></label>
                            <label>SOURCE<input type="number" min="0" step="0.01" value="0" aria-label="Region source offset" onInit={element => {
                                sourceOffsetInput = element
                                element.onchange = updateSelectedRegion
                            }}/></label>
                        </div>
                        <div className="toolbar-spacer"/>
                        <span className="timeline-note">Audio tracks · Kahu Rust/WASM runtime</span>
                    </div>
                </div>
                <div className="timeline-canvas">
                    <div className="timeline-navigation-row">
                        <div className="track-navigation-spacer" aria-hidden="true"/>
                        <div className="timeline-navigation-host" onInit={element => {
                            timelineViewport = element
                            timelineController.setWidth(element.clientWidth)
                            const navigation = createTimelineNavigation(
                                timelineController.range,
                                () => transport.snapshot().positionSeconds,
                                position => seekFromInput(position.toString()),
                            )
                            element.append(navigation.element)
                            timeAxisUpdatePosition = navigation.timeAxis.updatePosition
                        }}/>
                    </div>
                    <div className="track-timeline-scroll">
                        <div className="track-timeline-rows" onInit={element => trackTimelineRows = element}/>
                    </div>
                    <div className="timeline-playhead-surface" aria-hidden="true">
                        <div className="playhead" onInit={element => playhead = element}/>
                    </div>
                </div>
                <div className="timeline-range-row">
                    <div className="track-range-spacer" aria-hidden="true"/>
                    <div className="timeline-range-slider-host" onInit={element => element.append(createTimelineRangeSlider(timelineController.range))}/>
                </div>
            </section>
        </section>
        <section className="rack-panel" aria-label="Kahu rack" onInit={element => rackPanel = element}>
            <div className="rack-heading">
                <div className="rack-title-group"><span className="eyebrow">PROCESSING</span><h2 onInit={element => rackTitle = element}>Kahu Rack</h2></div>
                <span className="rack-note">Audio effects only · Kahu canonical runtime</span>
                <select className="module-picker" aria-label="Choose Kahu module" onInit={element => modulePicker = element}><option value="">Choose module</option></select>
                <button className="rack-bypass-button" type="button" onInit={element => {
                    bypassAllButton = element
                    element.setAttribute("aria-pressed", "false")
                    element.replaceChildren(Icon({symbol: IconSymbol.Exclude, className: "opendaw-button-icon"}))
                    element.onclick = toggleBypassAll
                }}/>
                <button className="rack-add-button" type="button" onInit={element => {
                    addRackSlotButton = element
                    element.setAttribute("aria-label", "Add processor")
                    element.replaceChildren(Icon({symbol: IconSymbol.Add, className: "opendaw-button-icon"}))
                    element.onclick = () => {
                        const track = trackStore.selected()
                        const moduleId = modulePicker?.value ?? ""
                        const module = catalogModules.find(candidate => candidate.id === moduleId)
                        if (track === undefined || module === undefined) return
                        const defaults = Object.fromEntries(module.parameters.map(parameter => [parameter.key, parameter.default]))
                        const device = rackStore.addModule(track.id, module.id, module.name, defaults)
                        refreshRack()
                        void initializeRuntime(track.id, device.id, module.id)
                    }
                }}/>
                <button className="rack-collapse-button" type="button" onInit={element => {
                    rackCollapseButton = element
                    element.onclick = toggleRackCollapsed
                    applyRackCollapsedState()
                }}/>
            </div>
            <div className="rack-chain" onInit={element => rackList = element}/>
        </section>
        <footer className="testbed-footer">
            <span>kahustack-dsp</span>
            <span className="runtime-info">{`${audioContext.sampleRate} Hz · 128 frame blocks`}</span>
            <label className="footer-trim">IN<span onInit={element => element.replaceChildren(createOpenDAWValueControl({
                min: -24,
                max: 12,
                step: 0.1,
                getValue: () => inputTrimDb,
                setValue: value => {
                    inputTrimDb = value
                    refreshTrackPlayers()
                },
                formatValue: value => `${value.toFixed(1)} dB`,
                label: "Input trim dB",
                className: "footer-value-control",
            }))}/></label>
            <label className="footer-trim">OUT<span onInit={element => element.replaceChildren(createOpenDAWValueControl({
                min: -24,
                max: 12,
                step: 0.1,
                getValue: () => outputTrimDb,
                setValue: value => {
                    outputTrimDb = value
                    setOutputTrim()
                },
                formatValue: value => `${value.toFixed(1)} dB`,
                label: "Output trim dB",
                className: "footer-value-control",
            }))}/></label>
            <button className={`compare-button${compareDry ? " active" : ""}`} type="button" aria-label="Toggle dry comparison" aria-pressed="false"
                    onInit={element => element.onclick = () => {
                        compareDry = !compareDry
                        setMonitorComparison()
                        element.classList.toggle("active", compareDry)
                        element.setAttribute("aria-pressed", compareDry ? "true" : "false")
                        element.textContent = compareDry ? "DRY" : "PROC"
                    }}>PROC</button>
            <canvas className="spectrum-canvas" width="96" height="16" aria-label="Output spectrum" onInit={element => spectrumCanvas = element}/>
            <span className="output-meter" aria-label="Output meter"><span className="meter-fill" onInit={element => meterFill = element}/></span>
            <span onInit={element => meterReadout = element}>-∞ dBFS</span>
        </footer>
    </main>
))

refreshTrackRows()
updateSelectedTrack()
refreshRack()
refreshTransport()
applyRackCollapsedState()
window.addEventListener("keydown", event => {
    dispatchTransportShortcut(event, {
        togglePlayback: () => {void toggleTransport()},
        stop: stopTransport,
        movePosition: moveTransportPosition,
        toggleLoop,
        toggleFollow,
    })
})
timelineController.range.subscribe(() => {
    updateTimelineRegionGeometry()
    refreshTransport()
})
if (timelineViewport !== undefined) {
    const observer = new ResizeObserver(() => {
        timelineController.setWidth(timelineViewport?.clientWidth ?? 0)
        updateTimelineRegionGeometry()
    })
    observer.observe(timelineViewport)
}
void loadCatalog()