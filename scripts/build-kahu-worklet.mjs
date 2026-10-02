// KBW-7 generation: emits the typed Kahu AudioWorklet as a standalone browser script.

import assert from "node:assert/strict"
import {mkdir, readFile, writeFile} from "node:fs/promises"
import {dirname, resolve} from "node:path"
import {fileURLToPath} from "node:url"
import ts from "typescript"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const childRoot = resolve(scriptDirectory, "..")
const sourcePath = resolve(childRoot, "packages/app/kahu-testbed/src/kahu-worklet.ts")
const outputPath = resolve(childRoot, "packages/app/kahu-testbed/public/worklets/kahu-gain-worklet.js")
const source = await readFile(sourcePath, "utf8")
const transpiled = ts.transpileModule(source, {
    compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        useDefineForClassFields: true,
        removeComments: false
    },
    fileName: sourcePath,
    reportDiagnostics: false
}).outputText
const executable = transpiled.replace(/\nexport \{\};\s*$/, "\n")
assert.match(executable, /registerProcessor\("kahu-dsp", KahuDspProcessor\)/)
assert.doesNotMatch(executable, /^\s*(?:import|export)\s/m)
await mkdir(dirname(outputPath), {recursive: true})
await writeFile(outputPath, `// GENERATED from ${sourcePath}. DO NOT EDIT.\n${executable}`)
console.log(`Generated ${outputPath}`)
