// KOD-6 staging: copies generated parent Rust-WASM/catalog assets into ignored testbed public assets.

import {copyFile, mkdir} from "node:fs/promises"
import {existsSync} from "node:fs"
import {dirname, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const childRoot = resolve(scriptDirectory, "..")
const packageRoot = resolve(childRoot, "packages/app/kahu-testbed")
const parentRoot = process.env.KAHU_DSP_ROOT === undefined
    ? resolve(childRoot, "..")
    : resolve(process.env.KAHU_DSP_ROOT)
const wasmSource = process.env.KAHU_DSP_WASM ?? resolve(parentRoot, "apps/testbench/public/wasm/kahu_dsp_wasm.wasm")
const manifestSource = process.env.KAHU_DSP_MANIFEST ?? resolve(parentRoot, "apps/testbench/public/library-manifest.json")
const outputRoot = resolve(packageRoot, "public/kahu-runtime")

if (!existsSync(wasmSource) || !existsSync(manifestSource)) {
    console.warn("Kahu Rust-WASM runtime assets are not staged; run the parent build or set KAHU_DSP_ROOT.")
    process.exit(0)
}

await mkdir(outputRoot, {recursive: true})
await copyFile(wasmSource, resolve(outputRoot, "kahu_dsp_wasm.wasm"))
await copyFile(manifestSource, resolve(outputRoot, "library-manifest.json"))
console.log(`Staged Kahu Rust-WASM runtime from ${parentRoot}`)
