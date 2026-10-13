import assert from "node:assert/strict"
import { test } from "node:test"
import { sheetFor } from "../src/explain.ts"

const page = {
  name: "Notes",
  play: "page",
  rowNote: "example.com. A public page.",
  evidence: [
    { label: "page", value: "Notes", source: "https://example.com/notes" },
    { label: "page text", value: "A public page.", source: "https://example.com/notes" },
    { label: "heading", value: "Export", source: "page html" },
    { label: "script", value: "https://example.com/assets/app.js", source: "page html" },
    { label: "form", value: "https://example.com/save", source: "page html" },
  ],
}

test("a page remake keeps the headings, scripts, and forms", () => {
  const sheet = sheetFor(page)
  assert.equal(sheet?.title, "The page")
  assert.deepEqual(sheet?.headings, ["Export"])
  assert.deepEqual(sheet?.scripts, ["example.com/assets/app.js"])
  assert.deepEqual(sheet?.forms, ["https://example.com/save"])
  assert.match(sheet?.lines.join(" ") ?? "", /Export/)
  assert.match(sheet?.lines.join(" ") ?? "", /app\.js/)
})

test("a curve stays on the trade cabinet", () => {
  assert.equal(sheetFor({ ...page, play: "curve" }), null)
})

test("an account remake lists the fields that were read", () => {
  const sheet = sheetFor({
    name: "USD Coin",
    play: "chain",
    rowNote: "USD Coin is a public mint on mainnet. The lines below are the fields this read could point at.",
    evidence: [
      { label: "supply", value: "100", source: "mint account, bytes 36-44" },
      { label: "decimals", value: "6", source: "mint account, byte 44" },
    ],
  })
  assert.equal(sheet?.title, "The account")
  assert.deepEqual(sheet?.fields, [
    { label: "supply", value: "100" },
    { label: "decimals", value: "6" },
  ])
})
