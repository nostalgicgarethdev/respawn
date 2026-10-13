import { extractAddress, publicHttps } from "./account.js"

export type SpeedRule = { start: number; accel: number; max: number }

export type PagePart = { label: "heading" | "script" | "form"; value: string }

export type PageLook = {
  url: string
  host: string
  title: string
  description: string
  speed: SpeedRule | null
  parts: PagePart[]
}

export function pumpMint(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (!/^(www\.)?pump\.fun$/i.test(url.hostname)) return null
  const [head, mint] = url.pathname.split("/").filter(Boolean)
  if (head !== "coin") return null
  return extractAddress(mint ?? "")
}

export function pageFacts(html: string): { title: string; description: string } {
  const title = metaContent(html, "og:title") || tagText(html, "title")
  const description = metaContent(html, "og:description") || metaContent(html, "description")
  return {
    title: title.replace(/\s+/g, " ").trim().slice(0, 180),
    description: description.replace(/\s+/g, " ").trim().slice(0, 240),
  }
}

export async function lookUp(input: string): Promise<PageLook> {
  const target = publicHttps(input)
  if (!target) throw new Error("Paste a public link.")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "text/html" },
    })
    if (!publicHttps(response.url)) throw new Error("That page is not public.")
    if (!response.ok) throw new Error("That page didn't answer.")
    const type = response.headers.get("content-type") ?? ""
    if (type && !type.includes("html") && !type.includes("text")) throw new Error("That file is not a page.")
    const html = await readHead(response)
    const facts = pageFacts(html)
    const url = new URL(response.url)
    return {
      url: url.toString(),
      host: url.hostname.replace(/^www\./, ""),
      title: facts.title,
      description: facts.description,
      speed: speedRule(html),
      parts: pageParts(html, url.toString(), facts.title),
    }
  } catch (error) {
    if (error instanceof Error && /Paste|not public|didn't answer|not a page/.test(error.message)) throw error
    throw new Error("That page didn't answer.")
  } finally {
    clearTimeout(timer)
  }
}

const PAGE_CAP = 750_000

export function speedRule(html: string): SpeedRule | null {
  const start = namedNumber(html, "SPEED")
  const accel = namedNumber(html, "ACCELERATION")
  const max = namedNumber(html, "MAX_SPEED")
  if (start === null || accel === null || max === null) return null
  if (!(start > 0 && start <= 30 && accel > 0 && accel <= 1 && max > start && max <= 40)) return null
  return { start, accel, max }
}

export function enoughPage(html: string): boolean {
  if (speedRule(html)) return true
  const facts = pageFacts(html)
  if (!facts.title) return false
  if (/<\/body>/i.test(html)) return true
  const headEnd = html.toLowerCase().indexOf("</head>")
  if (headEnd < 0) return false
  const titleAt = html.toLowerCase().search(/<title\b|property\s*=\s*["']og:title/i)
  if (facts.description && titleAt > headEnd) return true
  return facts.title.length > 0 && titleAt > headEnd && html.length > headEnd + 8_000
}

export function pageParts(html: string, pageUrl: string, title = ""): PagePart[] {
  const parts: PagePart[] = []
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
  const seen = new Set<string>()
  for (const heading of [...tagTexts(visible, "h1"), ...tagTexts(visible, "h2")]) {
    const key = heading.toLowerCase()
    if (!heading || key === title.toLowerCase() || seen.has(key)) continue
    seen.add(key)
    parts.push({ label: "heading", value: heading })
    if (parts.length >= 6) break
  }
  for (const src of attrValues(html, "script", "src")) {
    const absolute = publicUrl(src, pageUrl)
    if (!absolute || seen.has(absolute)) continue
    seen.add(absolute)
    parts.push({ label: "script", value: absolute })
    if (parts.filter((part) => part.label === "script").length >= 5) break
  }
  for (const action of attrValues(html, "form", "action")) {
    const absolute = publicUrl(action, pageUrl)
    if (!absolute || seen.has(absolute)) continue
    seen.add(absolute)
    parts.push({ label: "form", value: absolute })
    if (parts.filter((part) => part.label === "form").length >= 3) break
  }
  return parts
}

function tagTexts(html: string, tag: string): string[] {
  const out: string[] = []
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi")
  for (const match of html.matchAll(pattern)) {
    const text = decode(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
    if (text) out.push(text.slice(0, 140))
    if (out.length >= 8) break
  }
  return out
}

function attrValues(html: string, tag: string, name: string): string[] {
  const out: string[] = []
  const tags = html.match(new RegExp(`<${tag}\\b[^>]*>`, "gi")) ?? []
  for (const item of tags) {
    const value = attr(item, name)
    if (!value || value.startsWith("data:") || value.startsWith("javascript:")) continue
    out.push(value)
  }
  return out
}

function publicUrl(value: string, base: string): string | null {
  try {
    return publicHttps(new URL(value, base).toString())
  } catch {
    return null
  }
}

function namedNumber(html: string, key: string): number | null {
  const match = html.match(new RegExp(`\\b${key}\\b\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, "i"))
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

async function readHead(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ""
  const decoder = new TextDecoder()
  let html = ""
  try {
    while (html.length < PAGE_CAP) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      if (enoughPage(html)) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return html
}

function metaContent(html: string, key: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const name = (attr(tag, "property") || attr(tag, "name")).toLowerCase()
    if (name !== key) continue
    const content = decode(attr(tag, "content"))
    if (content) return content
  }
  return ""
}

function tagText(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return match ? decode(match[1].replace(/<[^>]+>/g, "")) : ""
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"))
  return match ? (match[2] ?? match[3] ?? "") : ""
}

function decode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}
