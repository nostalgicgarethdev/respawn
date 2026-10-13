export default async function handler(request: Request): Promise<Response> {
  try {
    const { readTarget } = await import("../src/readTarget")
    const query = new URL(request.url).searchParams.get("q") ?? ""
    return Response.json(await readTarget(query))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Read failed"
    const status = /Paste|No account|did not answer/.test(message) ? 400 : 500
    return Response.json({ error: message }, { status })
  }
}
