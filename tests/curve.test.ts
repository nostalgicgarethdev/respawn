import assert from "node:assert/strict"
import { test } from "node:test"
import { buy, curveAddress, formatSpot, parseCurve, sell } from "../src/curve.ts"
import { enoughPage, pageFacts, pageParts, pumpMint, speedRule } from "../src/look.ts"

const open = curveFrom({
  virtualToken: 1072964676107292n,
  virtualSol: 30000987654n,
  realToken: 793064676107292n,
  realSol: 987654n,
  supply: 1000000000000000n,
  complete: false,
})

test("a pump coin link yields the mint", () => {
  assert.equal(
    pumpMint("https://pump.fun/coin/EKtmPPLaCbEEKiwoHHtV7TsRsmPXs5CMGtQtZFSiinsc"),
    "EKtmPPLaCbEEKiwoHHtV7TsRsmPXs5CMGtQtZFSiinsc",
  )
  assert.equal(pumpMint("https://example.com/play"), null)
})

test("a coin page title and description come from the head", () => {
  const facts = pageFacts(`
    <html><head>
      <title>Ignored</title>
      <meta property="og:title" content="Stamp Price &amp; Chart"/>
      <meta property="og:description" content="Trade Stamp on Solana via Pump."/>
    </head></html>
  `)
  assert.equal(facts.title, "Stamp Price & Chart")
  assert.equal(facts.description, "Trade Stamp on Solana via Pump.")
})

test("a title streamed after the head still counts", () => {
  const early = "<html><head><meta charset=\"utf-8\"></head><body>"
  assert.equal(enoughPage(early), false)
  const late = `${early}<title>Stamp Price &amp; Chart</title><meta name="description" content="Trade Stamp."/>`
  assert.equal(enoughPage(late), true)
  assert.equal(pageFacts(late).title, "Stamp Price & Chart")
  const titled = `<html><head><title>Only</title></head>${"y".repeat(8001)}`
  assert.equal(enoughPage(titled), false)
  assert.equal(enoughPage(`${titled}</body>`), true)
})

test("a page read keeps headings and public scripts", () => {
  const html = `<html><head><title>Notes</title>
    <script src="/app.js"></script>
    <script src="javascript:alert(1)"></script>
  </head><body>
    <h1>Notes</h1>
    <h2>Export</h2>
    <h2>How<br>it works</h2>
    <form action="/save"></form>
  </body></html>`
  const parts = pageParts(html, "https://example.com/notes", "Notes")
  assert.deepEqual(parts, [
    { label: "heading", value: "Export" },
    { label: "heading", value: "How it works" },
    { label: "script", value: "https://example.com/app.js" },
    { label: "form", value: "https://example.com/save" },
  ])
})

test("a page that publishes the speed triple keeps those numbers", () => {
  const html = "<html><head><title>Runner</title><meta name=\"description\" content=\"A public speed rule.\"></head><body>SPEED: 6\nACCELERATION: 0.001\nMAX_SPEED: 13</body></html>"
  assert.deepEqual(speedRule(html), { start: 6, accel: 0.001, max: 13 })
  assert.equal(enoughPage(html), true)
  assert.equal(speedRule("<p>SPEED: 6</p>"), null)
})

test("bonding curve bytes match the account layout", () => {
  const curve = parseCurve(open)
  assert.equal(curve?.virtualSol, 30000987654n)
  assert.equal(curve?.complete, false)
  assert.equal(curveAddress("EKtmPPLaCbEEKiwoHHtV7TsRsmPXs5CMGtQtZFSiinsc"), "3rxBxY89YXxRWEpbJMcSNEcuUQ8HWQNb91ouhFNqV3gR")
})

test("a buy raises the price and a sell returns less SOL", () => {
  const curve = parseCurve(open)
  assert.ok(curve)
  const before = formatSpot(curve, 6)
  const bought = buy(curve, 100_000_000n)
  assert.ok(bought)
  assert.ok(bought.tokens > 0n)
  assert.ok(bought.curve.virtualSol * curve.virtualToken > curve.virtualSol * bought.curve.virtualToken)
  assert.notEqual(formatSpot(bought.curve, 6), before)
  const sold = sell(bought.curve, bought.tokens)
  assert.ok(sold)
  assert.ok(sold.lamports > 0n)
  assert.ok(sold.lamports <= 100_000_000n)
})

function curveFrom(fields: {
  virtualToken: bigint
  virtualSol: bigint
  realToken: bigint
  realSol: bigint
  supply: bigint
  complete: boolean
}): Uint8Array {
  const data = new Uint8Array(49)
  const view = new DataView(data.buffer)
  view.setBigUint64(0, 6966180631402821399n, true)
  view.setBigUint64(8, fields.virtualToken, true)
  view.setBigUint64(16, fields.virtualSol, true)
  view.setBigUint64(24, fields.realToken, true)
  view.setBigUint64(32, fields.realSol, true)
  view.setBigUint64(40, fields.supply, true)
  data[48] = fields.complete ? 1 : 0
  return data
}
