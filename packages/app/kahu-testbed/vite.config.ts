import {defineConfig} from "vite"
import crossOriginIsolation from "vite-plugin-cross-origin-isolation"

const isolationHeaders = {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp"
}

export default defineConfig({
    server: {
        port: 8081,
        host: "127.0.0.1",
        headers: isolationHeaders,
        fs: {
            allow: [".."]
        }
    },
    preview: {
        port: 8081,
        host: "127.0.0.1",
        headers: isolationHeaders
    },
    plugins: [crossOriginIsolation()]
})
