// KBW-1 staging: copies canonical parent Rust-WASM/catalog assets and manifest contract sources into
// ignored testbed build inputs. The browser host never authors a second manifest schema.

import {copyFile, mkdir, readFile, writeFile} from "node:fs/promises"
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
const generatedSourceRoot = resolve(packageRoot, "src/generated")
const canonicalTypesSource = resolve(parentRoot, "apps/testbench/src/types.ts")
const canonicalRuntimeSource = resolve(parentRoot, "apps/testbench/src/audio/LibraryManifestRuntime.ts")

const copyWithRetry = async (source, destination) => {
    for (let attempt = 0; ; attempt += 1) {
        try {
            await copyFile(source, destination)
            return
        } catch (error) {
            if (attempt >= 5 || !["EBUSY", "EPERM"].includes(error?.code)) throw error
            await new Promise(resolveDelay => setTimeout(resolveDelay, 50 * (attempt + 1)))
        }
    }
}

if (!existsSync(canonicalTypesSource) || !existsSync(canonicalRuntimeSource)) {
    console.warn("Canonical Kahu manifest contract sources are unavailable; set KAHU_DSP_ROOT to the parent repository.")
} else {
    await mkdir(generatedSourceRoot, {recursive: true})
    await copyWithRetry(canonicalTypesSource, resolve(generatedSourceRoot, "kahu-manifest-types.ts"))
    const runtimeSource = await readFile(canonicalRuntimeSource, "utf8")
    await writeFile(
        resolve(generatedSourceRoot, "kahu-manifest-runtime.ts"),
        runtimeSource.replace("from '../types.js'", "from './kahu-manifest-types.js'"),
        "utf8",
    )
}

if (!existsSync(wasmSource) || !existsSync(manifestSource)) {
    console.warn("Kahu Rust-WASM runtime assets are not staged; run the parent build or set KAHU_DSP_ROOT.")
    process.exit(0)
}

await mkdir(outputRoot, {recursive: true})
await copyWithRetry(wasmSource, resolve(outputRoot, "kahu_dsp_wasm.wasm"))
await copyWithRetry(manifestSource, resolve(outputRoot, "library-manifest.json"))
console.log(`Staged Kahu Rust-WASM runtime and canonical manifest contract from ${parentRoot}`)
