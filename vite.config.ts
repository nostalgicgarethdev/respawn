import type { IncomingMessage, ServerResponse } from "node:http"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import { lookUp } from "./src/look"
import { readTarget } from "./src/readTarget"

function readApi(): Plugin {
  return {
    name: "respawn-read-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? ""
        if (url.startsWith("/api/look")) {
          try {
            const target = new URL(url, "http://127.0.0.1").searchParams.get("u") ?? ""
            const result = await lookUp(target)
            res.statusCode = 200
            res.setHeader("content-type", "application/json")
            res.end(JSON.stringify(result))
          } catch (error) {
            const message = error instanceof Error ? error.message : "Read failed"
            res.statusCode = 400
            res.setHeader("content-type", "application/json")
            res.end(JSON.stringify({ error: message }))
          }
          return
        }
        if (!url.startsWith("/api/read")) return next()
        try {
          const query = new URL(url, "http://127.0.0.1").searchParams.get("q") ?? ""
          const result = await readTarget(query)
          res.statusCode = 200
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify(result))
        } catch (error) {
          const message = error instanceof Error ? error.message : "Read failed"
          res.statusCode = 400
          res.setHeader("content-type", "application/json")
          res.end(JSON.stringify({ error: message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), readApi()],
  server: { port: 5193, strictPort: true, host: "127.0.0.1" },
})
