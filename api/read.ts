import type { IncomingMessage, ServerResponse } from "node:http"

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const { readTarget } = await import("../src/readTarget.js")
    const query = new URL(request.url ?? "", "https://respawn.local").searchParams.get("q") ?? ""
    send(response, 200, await readTarget(query))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Read failed"
    const status = /Paste|Nothing lives|did not answer/.test(message) ? 400 : 500
    send(response, status, { error: message })
  }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader("content-type", "application/json")
  response.end(JSON.stringify(body))
}
