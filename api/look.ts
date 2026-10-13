import type { IncomingMessage, ServerResponse } from "node:http"

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  try {
    const target = new URL(request.url ?? "", "https://respawn.local").searchParams.get("u") ?? ""
    const { lookUp } = await import("../src/look.js")
    send(response, 200, await lookUp(target))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Read failed"
    const status = /Paste|not public|didn't answer|not a page/.test(message) ? 400 : 500
    send(response, status, { error: message })
  }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader("content-type", "application/json")
  response.end(JSON.stringify(body))
}
