// KOD-1 entrypoint: composes the isolated testbed shell without owning Studio runtime or DSP behavior.

import "./main.sass"
// The classic TypeScript JSX transform consumes createElement in generated output.
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
import {replaceChildren, createElement} from "@opendaw/lib-jsx"
import {initializeColors} from "@opendaw/studio-enums"
import {TestbedShell} from "./shell"
import {DEFAULT_TRANSPORT_DURATION_SECONDS, Transport} from "./transport"

initializeColors(document.documentElement)
document.title = TestbedShell.title

const transport = new Transport()
let timeReadout: HTMLElement | undefined
let musicalReadout: HTMLElement | undefined
let playhead: HTMLElement | undefined
let seekInput: HTMLInputElement | undefined
let positionInput: HTMLInputElement | undefined
let playButton: HTMLButtonElement | undefined
let animationFrame = 0

const refreshTransport = (): void => {
    const snapshot = transport.snapshot()
    timeReadout?.replaceChildren(snapshot.timecode)
    musicalReadout?.replaceChildren(snapshot.musicalPosition)
    playButton?.replaceChildren(snapshot.isPlaying ? "Ⅱ" : "▶")
    playButton?.setAttribute("aria-label", snapshot.isPlaying ? "Pause" : "Play")
    playhead?.style.setProperty("left", `${snapshot.positionSeconds / DEFAULT_TRANSPORT_DURATION_SECONDS * 100}%`)
    if (seekInput !== undefined) {
        seekInput.value = snapshot.positionSeconds.toString()
    }
    if (positionInput !== undefined && document.activeElement !== positionInput) {
        positionInput.value = snapshot.positionSeconds.toFixed(2)
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
    transport.seek(Number(value))
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
                        <strong>Main Input</strong>
                        <small>Awaiting source audio</small>
                    </div>
                </div>
                <div className="track-empty">Add a Kahu module to begin.</div>
            </aside>
            <section className="timeline-panel" aria-label="Timeline">
                <div className="timeline-toolbar">
                    <div className="transport-controls">
                        <button className="transport-button" type="button" aria-label="Play" onInit={element => {
                            playButton = element
                            element.onclick = () => {
                                transport.toggle()
                                restartTransportRefresh()
                            }
                        }}>▶</button>
                        <button className="stop-button" type="button" aria-label="Stop" onInit={element => {
                            element.onclick = () => {
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
                    <span className="timeline-note">Transport clock · no audio graph attached</span>
                </div>
                <div className="timeline-canvas">
                    <div className="ruler" aria-hidden="true">
                        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
                    </div>
                    <div className="lane-grid">
                        <div className="lane-label">MAIN INPUT</div>
                        <div className="lane-track">
                            <div className="empty-clip">Kahu DSP modules will appear here</div>
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
                    <p>KOD-2 will connect the testbed transport to the canonical Kahu runtime.</p>
                </div>
            </div>
        </section>
        <footer className="testbed-footer">
            <span>kahustack-dsp</span>
            <span>Source-only UI shell</span>
        </footer>
    </main>
))
