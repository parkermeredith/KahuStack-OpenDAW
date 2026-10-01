// KOD-3 entrypoint: composes the isolated shell and browser audio boundary without owning DSP behavior.

import "./main.sass"
// The classic TypeScript JSX transform consumes createElement in generated output.
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import {replaceChildren, createElement} from "@opendaw/lib-jsx"
import {initializeColors} from "@opendaw/studio-enums"
import {TestbedShell} from "./shell"
import {DEFAULT_TRANSPORT_DURATION_SECONDS, Transport} from "./transport"
import {AudioTrackPlayer, decodeAudioFile, DecodedAudioFile} from "./audio-track"
import {computeWaveformPeaks} from "./waveform"

initializeColors(document.documentElement)
document.title = TestbedShell.title

const audioContext = new AudioContext()
const transport = new Transport(() => audioContext.currentTime)
const audioPlayer = new AudioTrackPlayer(audioContext, () => {
    transport.stop()
    restartTransportRefresh()
})
let decodedTrack: DecodedAudioFile | undefined
let timeReadout: HTMLElement | undefined
let musicalReadout: HTMLElement | undefined
let playhead: HTMLElement | undefined
let seekInput: HTMLInputElement | undefined
let positionInput: HTMLInputElement | undefined
let playButton: HTMLButtonElement | undefined
let waveformCanvas: HTMLCanvasElement | undefined
let audioStatus: HTMLElement | undefined
let audioMetadata: HTMLElement | undefined
let trackTitle: HTMLElement | undefined
let trackSummary: HTMLElement | undefined
let animationFrame = 0

const refreshTransport = (): void => {
    const snapshot = transport.snapshot()
    timeReadout?.replaceChildren(snapshot.timecode)
    musicalReadout?.replaceChildren(snapshot.musicalPosition)
    playButton?.replaceChildren(snapshot.isPlaying ? "Ⅱ" : "▶")
    playButton?.setAttribute("aria-label", snapshot.isPlaying ? "Pause" : "Play")
    playhead?.style.setProperty("left", `${snapshot.positionSeconds / snapshot.durationSeconds * 100}%`)
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

const restartTransportRefresh = (): void => {
    if (animationFrame !== 0) {
        cancelAnimationFrame(animationFrame)
    }
    refreshTransport()
}

const seekFromInput = (value: string): void => {
    const position = Number(value)
    transport.seek(position)
    if (audioPlayer.hasAudio() && transport.snapshot().isPlaying) {
        audioPlayer.seek(position)
    }
    restartTransportRefresh()
}

const drawWaveform = (track: DecodedAudioFile): void => {
    const canvas = waveformCanvas
    const context = canvas?.getContext("2d")
    if (canvas === undefined || context === null || context === undefined) {
        return
    }
    const peaks = computeWaveformPeaks(track.buffer.getChannelData(0), canvas.width)
    const height = canvas.height
    const midpoint = height / 2
    context.clearRect(0, 0, canvas.width, height)
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-green")
    for (let column = 0; column < peaks.minimum.length; column++) {
        const top = midpoint - peaks.maximum[column] * midpoint * 0.85
        const bottom = midpoint - peaks.minimum[column] * midpoint * 0.85
        context.fillRect(column, top, 1, Math.max(1, bottom - top))
    }
}

const loadAudio = async (file: File): Promise<void> => {
    try {
        audioPlayer.stop()
        transport.stop()
        const track = await decodeAudioFile(audioContext, file)
        decodedTrack = track
        audioPlayer.load(track.buffer)
        transport.setDuration(track.durationSeconds)
        trackTitle?.replaceChildren(track.name)
        trackSummary?.replaceChildren("Ready")
        audioMetadata?.replaceChildren(`${track.durationSeconds.toFixed(2)} s · ${track.sampleRate} Hz · ${track.channelCount} ch`)
        audioStatus?.replaceChildren("Audio ready — press Play")
        waveformCanvas?.classList.remove("hidden")
        drawWaveform(track)
        restartTransportRefresh()
    } catch {
        decodedTrack = undefined
        audioPlayer.clear()
        audioStatus?.replaceChildren(`Unable to decode ${file.name}`)
        trackSummary?.replaceChildren("Decode failed")
    }
}

const toggleTransport = async (): Promise<void> => {
    if (transport.snapshot().isPlaying) {
        audioPlayer.pause()
        transport.pause()
    } else {
        await audioContext.resume()
        transport.play()
        if (decodedTrack !== undefined) {
            audioPlayer.play(transport.snapshot().positionSeconds)
        }
    }
    restartTransportRefresh()
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
            <span className="engine-status">{TestbedShell.engineStatus}</span>
            <button className="header-button" type="button" disabled aria-label="Settings are not connected yet">
                SETUP
            </button>
        </header>
        <section className="workspace" aria-label="KahuStack DSP testbed workspace">
            <aside className="track-panel" aria-label="Track list">
                <div className="panel-heading">
                    <span>TRACKS</span>
                    <button className="icon-button" type="button" disabled aria-label="Add track">+</button>
                </div>
                <div className="track-row selected">
                    <span className="track-color" aria-hidden="true"/>
                    <div>
                        <strong onInit={element => trackTitle = element}>Main Input</strong>
                        <small onInit={element => trackSummary = element}>Awaiting source audio</small>
                    </div>
                </div>
                <div className="track-empty">Add a Kahu module to begin.</div>
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
                                audioPlayer.stop()
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
                    <div className="toolbar-spacer"/>
                    <label className="zoom-control">ZOOM
                        <input type="range" min="1" max="4" step="0.25" value="1" aria-label="Timeline zoom"
                               onInit={element => element.oninput = () => {
                                   const canvas = waveformCanvas
                                   if (canvas !== undefined) {
                                       canvas.style.width = `${Number(element.value) * 100}%`
                                   }
                               }}/>
                    </label>
                    <span className="timeline-note">Audio track · Web Audio runtime</span>
                </div>
                <div className="timeline-canvas">
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
                                           onInit={element => element.onchange = () => {
                                               const file = element.files?.[0]
                                               if (file !== undefined) {
                                                   void loadAudio(file)
                                               }
                                           }}/>
                                </label>
                                <canvas className="waveform-canvas hidden" width="1200" height="160"
                                        aria-label="Source audio waveform"
                                        onInit={element => waveformCanvas = element}/>
                            </div>
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
                    <h2>Kahu Rack</h2>
                </div>
                <span className="rack-note">Prepared Rust/WASM modules will load here</span>
            </div>
            <div className="rack-empty">
                <span className="rack-empty-mark" aria-hidden="true">＋</span>
                <div>
                    <strong>No module selected</strong>
                    <p>KOD-4 will connect selected source tracks to the canonical Kahu runtime.</p>
                </div>
            </div>
        </section>
        <footer className="testbed-footer">
            <span>kahustack-dsp</span>
            <span>Source-only UI shell</span>
        </footer>
    </main>
))
