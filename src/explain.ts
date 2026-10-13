import type { Evidence } from "./readTarget"

export type Sheet = {
  title: string
  kicker: string
  lines: string[]
  text: string
  headings: string[]
  scripts: string[]
  forms: string[]
  fields: { label: string; value: string }[]
}

type ReadLike = {
  name: string
  play: string
  rowNote: string
  evidence: Evidence[]
}

export function sheetFor(read: ReadLike): Sheet | null {
  if (read.play === "curve") return null
  const headings = values(read.evidence, "heading")
  const scripts = values(read.evidence, "script").map(scriptLabel)
  const forms = values(read.evidence, "form")
  const text = values(read.evidence, "page text")[0] ?? ""
  if (read.play === "runner" && headings.length + scripts.length + forms.length === 0) return null
  if (read.play === "page" || read.play === "runner") {
    return {
      title: read.play === "runner" ? "The rest of the page" : "The page",
      kicker: read.play === "runner" ? "02" : "01",
      lines: pageLines(read.rowNote, headings, scripts, forms, Boolean(text), read.play === "runner"),
      text,
      headings,
      scripts,
      forms,
      fields: [],
    }
  }
  const fields = read.evidence
    .filter((item) => item.label !== "page" && item.label !== "page text")
    .slice(0, 8)
    .map((item) => ({ label: item.label, value: item.value }))
  return {
    title: "The account",
    kicker: "01",
    lines: [read.rowNote, fields.length ? "The fields below are the remake." : "This read has no fields to remake."],
    text: "",
    headings: [],
    scripts: [],
    forms: [],
    fields,
  }
}

function pageLines(
  rowNote: string,
  headings: string[],
  scripts: string[],
  forms: string[],
  hasText: boolean,
  runner: boolean,
): string[] {
  const lines = runner ? ["The speed rule plays above. This is the rest of that page."] : [rowNote]
  if (headings.length) lines.push(`Headings: ${headings.join(". ")}.`)
  if (scripts.length) lines.push(`Scripts: ${scripts.join(", ")}.`)
  if (forms.length) lines.push(`Forms: ${forms.join(", ")}.`)
  if (!runner && headings.length + scripts.length + forms.length === 0) {
    lines.push(hasText ? "The remake is that title and text." : "The remake is the title.")
  }
  return lines
}

function values(evidence: Evidence[], label: string): string[] {
  return evidence.filter((item) => item.label === label && item.value.trim()).map((item) => item.value.trim())
}

function scriptLabel(value: string): string {
  try {
    const url = new URL(value)
    const path = url.pathname.split("/").filter(Boolean).slice(-2).join("/")
    const host = url.hostname.replace(/^www\./, "")
    return path ? `${host}/${path}` : host
  } catch {
    return value.slice(0, 80)
  }
}
