import assert from "node:assert/strict"
import { test } from "node:test"
import {
  decodeBase58,
  encodeBase58,
  extractAddress,
  formatSupply,
  metadataAddress,
  parseMint,
  parseToken2022Metadata,
  publicHttps,
  parseUpgradeable,
  shortName,
} from "../src/account.ts"

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const SOL = "So11111111111111111111111111111111111111112"

test("base58 round-trips a mint", () => {
  const bytes = decodeBase58(USDC)
  assert.equal(bytes?.length, 32)
  assert.equal(encodeBase58(bytes!), USDC)
})

test("token-2022 metadata extension carries the coin name", () => {
  const name = "Zcash Shielded Assets"
  const symbol = "Stamp"
  const uri = "https://ipfs.io/ipfs/example"
  const body = new Uint8Array(64 + 4 + name.length + 4 + symbol.length + 4 + uri.length)
  const view = new DataView(body.buffer)
  let cursor = 64
  for (const value of [name, symbol, uri]) {
    view.setUint32(cursor, value.length, true)
    cursor += 4
    body.set(new TextEncoder().encode(value), cursor)
    cursor += value.length
  }
  const data = new Uint8Array(170 + 4 + 64 + body.length)
  data[165] = 1
  const head = new DataView(data.buffer)
  head.setUint16(166, 18, true)
  head.setUint16(168, 64, true)
  head.setUint16(234, 19, true)
  head.setUint16(236, body.length, true)
  data.set(body, 238)
  const meta = parseToken2022Metadata(data)
  assert.equal(meta?.name, name)
  assert.equal(meta?.symbol, symbol)
  assert.equal(meta?.uri, uri)
  assert.equal(parseToken2022Metadata(new Uint8Array(82)), null)
})

test("a link yields the address inside it", () => {
  assert.equal(extractAddress(`https://pump.fun/coin/${SOL}`), SOL)
  assert.equal(extractAddress("not an address"), null)
})

test("mint bytes expose supply, decimals, and authorities", () => {
  const data = new Uint8Array(82)
  const view = new DataView(data.buffer)
  view.setUint32(0, 0, true)
  view.setBigUint64(36, 1_500_000n, true)
  data[44] = 6
  data[45] = 1
  view.setUint32(46, 0, true)
  const mint = parseMint(data)
  assert.equal(mint?.decimals, 6)
  assert.equal(mint?.supply, 1_500_000n)
  assert.equal(mint?.mintAuthority, null)
  assert.equal(formatSupply(mint!.supply, mint!.decimals), "1.5")
})

test("upgradeable program state points at program data", () => {
  const data = new Uint8Array(36)
  const view = new DataView(data.buffer)
  view.setUint32(0, 2, true)
  const programData = decodeBase58(SOL)!
  data.set(programData, 4)
  const parsed = parseUpgradeable(data)
  assert.equal(parsed?.kind, "program")
  if (parsed?.kind === "program") assert.equal(parsed.programData, SOL)
})

test("metadata address matches the USDC metadata account", () => {
  assert.equal(metadataAddress(USDC), "5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq")
})

test("only public https metadata urls are followed", () => {
  assert.equal(publicHttps("https://arweave.net/abc"), "https://arweave.net/abc")
  assert.equal(publicHttps("http://arweave.net/abc"), null)
  assert.equal(publicHttps("https://127.0.0.1/secret"), null)
  assert.equal(publicHttps("https://user:pass@arweave.net/abc"), null)
  assert.equal(publicHttps("ipfs://abc"), null)
})

test("ticker keeps letters and digits", () => {
  assert.equal(shortName(" $usdc ", "MINT"), "USDC")
  assert.equal(shortName("***", "MINT"), "MINT")
})
