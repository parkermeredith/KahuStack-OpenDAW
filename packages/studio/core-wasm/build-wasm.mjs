// Build the Rust engine and device WASM artifacts on Windows and Unix hosts.
import { execFileSync, spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs"
import path from "node:path"

const packageRoot = process.cwd()
const repositoryRoot = path.resolve(packageRoot, "../../..")
const cratesRoot = path.join(repositoryRoot, "crates")
const target = "wasm32-unknown-unknown"
const outputRoot = path.join(cratesRoot, "target", target, "release")
const wasmRoot = path.join(packageRoot, "dist", "wasm")
const wasmPluginsRoot = path.join(wasmRoot, "plugins")
const deviceCrates = [
    "device-cubed", "device-autotune", "device-revamp", "device-pitch", "device-arpeggio",
    "device-zeitgeist", "device-tidal", "device-vaporisateur", "device-neon", "device-tubular",
    "device-nano", "device-delay", "device-playfield-sample", "device-gate", "device-werkstatt",
    "device-apparat", "device-spielwerk", "device-waveshaper", "device-crusher", "device-fold",
    "device-stereo-tool", "device-velocity", "device-maximizer", "device-compressor", "device-reverb",
    "device-dattorro-reverb", "device-convolver", "device-soundfont", "device-vocoder", "device-neural-amp",
]
const cargo = process.platform === "win32" ? "cargo.exe" : "cargo"

const runCargo = (args, rustflags) => execFileSync(cargo, args, {
    cwd: cratesRoot,
    env: { ...process.env, RUSTFLAGS: rustflags },
    stdio: "inherit",
})

runCargo(["rustc", "-p", "engine", "--release", "--target", target, "--", "-C", "link-arg=--import-memory", "-C", "link-arg=--import-table", "-C", "link-arg=--no-check-features"], "-C target-feature=+simd128")
runCargo(["build", "-p", "stretch-wasm", "--release", "--target", target], "-C target-feature=+simd128")

const deviceRustflags = "-C relocation-model=pic -C target-feature=+simd128 -C link-arg=--experimental-pic -C link-arg=-shared -C link-arg=--no-check-features -Zunstable-options -Cpanic=immediate-abort -Zdefault-visibility=hidden"
const deviceToolchain = process.env.DEVICE_TOOLCHAIN ?? "nightly"
for (const crate of deviceCrates) {
    runCargo([`+${deviceToolchain}`, "build", "-p", crate, "--release", "--target", target, "-Zbuild-std=core"], deviceRustflags)
}

const wasmOpt = process.platform === "win32" ? "wasm-opt.exe" : "wasm-opt"
const modules = ["engine", "stretch_wasm", ...deviceCrates.map((crate) => crate.replaceAll("-", "_"))]
if (spawnSync(wasmOpt, ["--version"], { stdio: "ignore" }).status === 0) {
    for (const module of modules) {
        const input = path.join(outputRoot, `${module}.wasm`)
        const optimized = `${input}.opt-${process.pid}`
        execFileSync(wasmOpt, ["-Oz", "--enable-bulk-memory", "--enable-mutable-globals", "--enable-simd", "--enable-sign-ext", "--enable-nontrapping-float-to-int", "--enable-multivalue", "--enable-reference-types", input, "-o", optimized], { stdio: "inherit" })
        rmSync(input)
        renameSync(optimized, input)
    }
    console.log(`wasm-opt: optimised ${modules.join(" ")}`)
} else {
    console.log("wasm-opt not found (install Binaryen) - shipping unoptimised modules")
}

mkdirSync(wasmPluginsRoot, { recursive: true })
for (const module of ["engine", "stretch_wasm"]) {
    const input = path.join(outputRoot, `${module}.wasm`)
    if (!existsSync(input)) throw new Error(`Missing Rust WASM artifact: ${input}`)
    copyFileSync(input, path.join(wasmRoot, `${module}.wasm`))
}
for (const crate of deviceCrates) {
    const module = crate.replaceAll("-", "_")
    const input = path.join(outputRoot, `${module}.wasm`)
    if (!existsSync(input)) throw new Error(`Missing Rust WASM artifact: ${input}`)
    copyFileSync(input, path.join(wasmPluginsRoot, `${module}.wasm`))
}
console.log("built: engine.wasm + stretch_wasm.wasm + stock devices + werkstatt/apparat/spielwerk")
