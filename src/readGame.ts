import { extractAddress, formatSupply } from "./account.js"
import { formatSol, type Curve } from "./curve.js"
import type { Evidence, ReadResult } from "./readTarget.js"
import { readBondingCurve, readTarget } from "./readTarget.js"
import { pumpMint, type PageLook, type PagePart, type SpeedRule } from "./look.js"
import type { DropRow } from "./rules.js"

export type GameRead = {
  address: string
  kind: string
  name: string
  ticker: string
  every: number
  canMint: boolean
  rows: DropRow[] | null
  rowNote: string
  evidence: Evidence[]
  solscan: string
  play: "curve" | "chain" | "page" | "runner"
  curve: Curve | null
  decimals: number
  speed: SpeedRule | null
}

export async function readGame(input: string): Promise<GameRead> {
  const trimmed = input.trim()
  const mint = pumpMint(trimmed)
  const link = /^https:\/\//i.test(trimmed) ? trimmed : ""
  const bare = link ? null : extractAddress(trimmed)
  if (!mint && !link && !bare) throw new Error("That is not a public https link or a Solana address. Try a web page, a pump.fun coin link, or a mint.")

  const chainInput = mint || bare || ""
  const [page, curvePack, chainPack] = await Promise.all([
    link ? readPage(link) : Promise.resolve(null),
    (mint || bare) ? readBondingCurve((mint || bare) as string).catch(() => null) : Promise.resolve(null),
    readChain(chainInput),
  ])
  const chain = chainPack.chain
  const chainError = chainPack.error

  if (mint && !curvePack) {
    if (chainError && /did not answer/.test(chainError.message)) throw chainError
    throw new Error("No bonding curve on that coin.")
  }
  if (!mint && !chain && chainError && !page) throw chainError
  if (!mint && !chain && !page) throw new Error("Paste a public link.")

  const decimals = chain?.decimals ?? 6
  const evidence: Evidence[] = []
  if (page?.title) evidence.push({ label: "page", value: page.title, source: page.url })
  if (page?.description) evidence.push({ label: "page text", value: page.description, source: page.url })
  for (const part of page?.parts ?? []) {
    evidence.push({ label: part.label, value: part.value, source: "page html" })
  }
  if (curvePack) evidence.push(...curveEvidence(curvePack.address, curvePack.curve, decimals))
  if (chain) evidence.push(...chain.evidence)

  const name = chain?.name || page?.title || "Game"
  const ticker = chain?.ticker || "COIN"
  const address = chain?.address || mint || ""
  if (curvePack) {
    const finished = curvePack.curve.complete || curvePack.curve.virtualToken === 0n
    return {
      address,
      kind: "curve",
      name,
      ticker,
      every: chain?.every ?? 10,
      canMint: false,
      rows: null,
      rowNote: finished
        ? `${name} has graduated off its pump.fun curve, so there is nothing left to replay. Its final curve numbers are below.`
        : `The pump.fun curve for ${name} is open. Price is virtual SOL over virtual tokens. Buys stay in the browser.`,
      evidence,
      solscan: chain?.solscan || `https://solscan.io/account/${address}`,
      play: "curve",
      curve: curvePack.curve,
      decimals,
      speed: null,
    }
  }

  if (page?.speed) {
    return runnerGame(page, evidence)
  }

  if (link && page) {
    return pageGame(page, chain, evidence)
  }

  if (chain?.playable) {
    return {
      address: chain.address,
      kind: chain.kind,
      name: chain.name,
      ticker: chain.ticker,
      every: chain.every,
      canMint: chain.canMint,
      rows: chain.rows,
      rowNote: `${chain.name} is a public ${chain.kind.replace("-", " ")} on mainnet. The lines below are the fields this read could point at.`,
      evidence,
      solscan: chain.solscan,
      play: "chain",
      curve: null,
      decimals,
      speed: null,
    }
  }

  return {
    address,
    kind: chain?.kind ?? "page",
    name,
    ticker,
    every: 10,
    canMint: false,
    rows: null,
    rowNote: page?.description || chain?.rowNote || "This page didn't publish a mechanic to play.",
    evidence,
    solscan: address ? `https://solscan.io/account/${address}` : "",
    play: "page",
    curve: null,
    decimals,
    speed: null,
  }
}

async function readChain(input: string): Promise<{ chain: ReadResult | null; error: Error | null }> {
  if (!input) return { chain: null, error: null }
  try {
    return { chain: await readTarget(input), error: null }
  } catch (error) {
    return { chain: null, error: error instanceof Error ? error : new Error("Read failed") }
  }
}

async function readPage(link: string): Promise<PageLook | null> {
  try {
    const response = await fetch(`/api/look?u=${encodeURIComponent(link)}`)
    if (!response.ok) return null
    const body = (await response.json()) as Partial<PageLook>
    if (typeof body.url !== "string" || typeof body.host !== "string") return null
    return {
      url: body.url,
      host: body.host,
      title: typeof body.title === "string" ? body.title : "",
      description: typeof body.description === "string" ? body.description : "",
      speed: readSpeed(body.speed),
      parts: readParts(body.parts),
    }
  } catch {
    return null
  }
}

function readParts(value: PagePart[] | null | undefined): PagePart[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (part) =>
        part &&
        (part.label === "heading" || part.label === "script" || part.label === "form") &&
        typeof part.value === "string" &&
        part.value.trim(),
    )
    .slice(0, 14)
    .map((part) => ({ label: part.label, value: part.value.trim().slice(0, 200) }))
}

function readSpeed(value: SpeedRule | null | undefined): SpeedRule | null {
  if (!value) return null
  const { start, accel, max } = value
  if (![start, accel, max].every((item) => typeof item === "number" && Number.isFinite(item))) return null
  return { start, accel, max }
}

function runnerGame(page: PageLook, evidence: Evidence[]): GameRead {
  const speed = page.speed!
  evidence.push(
    { label: "start", value: String(speed.start), source: "page text SPEED" },
    { label: "accel", value: String(speed.accel), source: "page text ACCELERATION" },
    { label: "max", value: String(speed.max), source: "page text MAX_SPEED" },
  )
  return {
    address: "",
    kind: "runner",
    name: page.title || page.host,
    ticker: "SCORE",
    every: 10,
    canMint: false,
    rows: null,
    rowNote: `${page.host} publishes a speed rule. It starts at ${speed.start}, adds ${speed.accel} each update, and stops climbing at ${speed.max}.`,
    evidence,
    solscan: "",
    play: "runner",
    curve: null,
    decimals: 0,
    speed,
  }
}

function pageGame(page: PageLook, chain: ReadResult | null, evidence: Evidence[]): GameRead {
  return {
    address: chain?.address || "",
    kind: "page",
    name: chain?.name || page.title || page.host,
    ticker: chain?.ticker || "GAME",
    every: chain?.every ?? 10,
    canMint: false,
    rows: null,
    rowNote: page.description
      ? `${page.host}. ${page.description}`
      : `A public page on ${page.host}. The lines below are what that page serves.`,
    evidence,
    solscan: chain?.solscan || "",
    play: "page",
    curve: null,
    decimals: chain?.decimals ?? 6,
    speed: null,
  }
}

function curveEvidence(address: string, curve: Curve, decimals: number): Evidence[] {
  return [
    { label: "curve", value: address, source: "bonding-curve pda" },
    { label: "virtual sol", value: `${formatSol(curve.virtualSol)} SOL`, source: "bonding curve bytes 16-24" },
    { label: "virtual tokens", value: formatSupply(curve.virtualToken, decimals), source: "bonding curve bytes 8-16" },
    { label: "real sol", value: `${formatSol(curve.realSol)} SOL`, source: "bonding curve bytes 32-40" },
    { label: "real tokens", value: formatSupply(curve.realToken, decimals), source: "bonding curve bytes 24-32" },
    { label: "complete", value: curve.complete ? "yes" : "no", source: "bonding curve byte 48" },
  ]
}
