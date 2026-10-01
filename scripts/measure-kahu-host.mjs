// KOD-10 evidence helper: reports generated host artifact sizes for repeatable local comparisons.

import {readdir, stat} from "node:fs/promises"
import {resolve} from "node:path"
import {fileURLToPath} from "node:url"

const childRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const packageRoot = resolve(childRoot, "packages/app/kahu-testbed")
const assetRoot = resolve(packageRoot, "dist/assets")
const assetNames = await readdir(assetRoot)
const distBytes = (await Promise.all(assetNames.map(async name => (await stat(resolve(assetRoot, name))).size)))
    .reduce((total, size) => total + size, 0)
const runtimeBytes = (await stat(resolve(packageRoot, "public/kahu-runtime/kahu_dsp_wasm.wasm"))).size
const workletBytes = (await stat(resolve(packageRoot, "public/worklets/kahu-gain-worklet.js"))).size
console.log(JSON.stringify({distBytes, rustWasmBytes: runtimeBytes, workletBytes, assetCount: assetNames.length}))
