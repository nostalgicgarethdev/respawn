import {
  METADATA_PROGRAM,
  TOKEN_2022,
  TOKEN_PROGRAM,
  UPGRADEABLE_LOADER,
  extractAddress,
  formatSupply,
  idlAddress,
  metadataAddress,
  parseMetadata,
  parseMint,
  parseToken2022Metadata,
  parseTokenAccount,
  parseUpgradeable,
  publicHttps,
  shortName,
} from "./account.js"
import { curveAddress, parseCurve, PUMP, type Curve } from "./curve.js"
import type { DropRow } from "./rules.js"

const ENDPOINTS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"]
const SYSTEM_PROGRAM = "11111111111111111111111111111111"
const SKIP_OWNERS = new Set([
  SYSTEM_PROGRAM,
  TOKEN_PROGRAM,
  TOKEN_2022,
  METADATA_PROGRAM,
  UPGRADEABLE_LOADER,
  "BPFLoader2111111111111111111111111111111111",
  "BPFLoader1111111111111111111111111111111111",
  "NativeLoader1111111111111111111111111111111",
])

export type Evidence = { label: string; value: string; source: string }

export type ReadResult = {
  address: string
  kind: "mint" | "program" | "token-account" | "account" | "wallet"
  name: string
  ticker: string
  every: number
  decimals: number | null
  canMint: boolean
  playable: boolean
  rows: DropRow[] | null
  rowNote: string
  evidence: Evidence[]
  solscan: string
}

type Account = {
  owner: string
  executable: boolean
  data: Uint8Array
  space: number
}

export async function readBondingCurve(mint: string): Promise<{ address: string; curve: Curve } | null> {
  const address = curveAddress(mint)
  const account = await getAccount(address)
  if (!account || account.owner !== PUMP) return null
  const curve = parseCurve(account.data)
  if (!curve) return null
  return { address, curve }
}

export async function readTarget(input: string): Promise<ReadResult> {
  const address = extractAddress(input)
  if (!address) throw new Error("Paste a Solana address, or a link that contains one.")
  const account = await getAccount(address)
  if (!account) throw new Error("Nothing lives at that address on mainnet right now. An empty wallet has no account to read.")

  if (account.owner === TOKEN_PROGRAM || account.owner === TOKEN_2022) {
    const mint = parseMint(account.data)
    if (mint) return finishMint(address, account.owner, mint, account.data)
    const token = parseTokenAccount(account.data)
    if (token) {
      const underlying = await readTarget(token.mint)
      underlying.kind = "token-account"
      const decimals = underlying.decimals ?? 0
      underlying.evidence.unshift({
        label: "token account",
        value: `${formatSupply(token.amount, decimals)} of ${token.mint}`,
        source: "spl token account",
      })
      return underlying
    }
  }

  if (account.executable || account.owner === UPGRADEABLE_LOADER) {
    return finishProgram(address, account)
  }

  const evidence: Evidence[] = [
    { label: "owner", value: account.owner, source: "account owner" },
    { label: "size", value: `${account.space} bytes`, source: "account length" },
  ]
  if (account.owner === SYSTEM_PROGRAM && account.space === 0) {
    const lamports = await rpc("getBalance", [address]).catch(() => null)
    const sol = typeof lamports === "number" ? (lamports / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 }) : "unknown"
    return {
      address,
      kind: "wallet",
      name: shortName(address, "WALLET"),
      ticker: shortName(address.slice(0, 4), "WALLET"),
      every: 10,
      decimals: null,
      canMint: false,
      playable: false,
      rows: null,
      rowNote: `A plain Solana wallet holding ${sol} SOL. Wallets have no program or curve to rebuild, so this shows the public account fields. Paste a coin mint or pump.fun link to get a playable remake.`,
      evidence: [{ label: "balance", value: `${sol} SOL`, source: "getBalance" }, ...evidence],
      solscan: solscan(address),
    }
  }
  if (!SKIP_OWNERS.has(account.owner)) {
    const owner = await getAccountHead(account.owner).catch(() => null)
    if (owner?.executable) {
      const surface = await readProgramSurface(account.owner)
      return {
        address,
        kind: "account",
        name: surface.name,
        ticker: surface.ticker,
        every: 10,
        decimals: null,
        canMint: true,
        playable: true,
        rows: surface.rows,
        rowNote: `This account is owned by ${surface.name}. ${surface.note}`,
        evidence: [...evidence, ...surface.evidence],
        solscan: solscan(address),
      }
    }
  }
  return {
    address,
    kind: "account",
    name: shortName(address, "ACCT"),
    ticker: shortName(address.slice(0, 4), "ACCT"),
    every: 10,
    decimals: null,
    canMint: false,
    playable: false,
    rows: null,
    rowNote: "Nothing here points at a mint or a program, so there is no remake yet.",
    evidence,
    solscan: solscan(address),
  }
}

async function finishMint(
  address: string,
  owner: string,
  mint: NonNullable<ReturnType<typeof parseMint>>,
  data: Uint8Array,
): Promise<ReadResult> {
  const evidence: Evidence[] = [
    { label: "supply", value: formatSupply(mint.supply, mint.decimals), source: "mint account, bytes 36-44" },
    { label: "decimals", value: String(mint.decimals), source: "mint account, byte 44" },
    { label: "mint authority", value: mint.mintAuthority ?? "revoked", source: "mint account, bytes 0-36" },
    { label: "freeze authority", value: mint.freezeAuthority ?? "revoked", source: "mint account, bytes 46-82" },
    { label: "token program", value: owner === TOKEN_2022 ? "token-2022" : "token", source: "account owner" },
  ]
  let name = ""
  let symbol = ""
  const [metadata, authority] = await Promise.all([
    getAccount(metadataAddress(address)).catch(() => null),
    mint.mintAuthority ? getAccountHead(mint.mintAuthority).catch(() => null) : Promise.resolve(null),
  ])
  const parsed = metadata && metadata.owner === METADATA_PROGRAM ? parseMetadata(metadata.data) : null
  const extension = parsed || owner !== TOKEN_2022 ? null : parseToken2022Metadata(data)
  const meta = parsed ?? extension
  if (meta) {
    name = meta.name
    symbol = meta.symbol
    const source = parsed ? "metaplex metadata" : "token-2022 metadata extension"
    evidence.unshift(
      { label: "name", value: meta.name || "empty", source: `${source} name` },
      { label: "symbol", value: meta.symbol || "empty", source: `${source} symbol` },
    )
    if (meta.uri) evidence.push({ label: "uri", value: meta.uri, source: `${source} uri` })
  }
  const [json, surface] = await Promise.all([
    meta?.uri ? readMetadataJson(meta.uri) : Promise.resolve(null),
    authority?.executable && mint.mintAuthority ? readProgramSurface(mint.mintAuthority) : Promise.resolve(null),
  ])
  if (json?.description) evidence.push({ label: "description", value: json.description, source: "metadata json" })
  if (json?.external) evidence.push({ label: "external", value: json.external, source: "metadata json" })
  if (json?.image) evidence.push({ label: "image", value: json.image, source: "metadata json" })
  if (mint.mintAuthority) {
    evidence.push({
      label: "authority account",
      value: authority?.executable ? "program" : authority ? "not a program" : "unread",
      source: mint.mintAuthority,
    })
  }
  if (surface) evidence.push(...surface.evidence)
  const ticker = shortName(symbol || name, shortName(address.slice(0, 4), "MINT"))
  const every = clamp(mint.decimals === 0 ? 3 : mint.decimals, 3, 20)
  const canMint = mint.mintAuthority !== null
  const mintRule = canMint
    ? `This remake mints ${ticker} every ${every} coins. That interval is the mint decimals.`
    : `Mint authority is revoked, so this remake scores ${ticker} and does not write new drops.`
  return {
    address,
    kind: "mint",
    name: name || ticker,
    ticker,
    every,
    decimals: mint.decimals,
    canMint,
    playable: true,
    rows: surface?.rows ?? null,
    rowNote: surface ? `${mintRule} ${surface.note}` : mintRule,
    evidence,
    solscan: solscan(address),
  }
}

async function finishProgram(address: string, account: Account): Promise<ReadResult> {
  const evidence: Evidence[] = [
    { label: "executable", value: account.executable ? "yes" : "no", source: "account executable flag" },
    { label: "owner", value: account.owner, source: "account owner" },
    { label: "size", value: `${account.space} bytes`, source: "account length" },
  ]
  const upgrade = account.owner === UPGRADEABLE_LOADER ? parseUpgradeable(account.data) : null
  if (upgrade?.kind === "program") {
    const programData = await getAccount(upgrade.programData, 48).catch(() => null)
    const parsed = programData ? parseUpgradeable(programData.data) : null
    evidence.push({
      label: "upgrade authority",
      value: parsed?.kind === "program-data" ? (parsed.upgradeAuthority ?? "revoked") : "unread",
      source: `programdata ${upgrade.programData}`,
    })
  }
  const surface = await readProgramSurface(address)
  return {
    address,
    kind: "program",
    name: surface.name,
    ticker: surface.ticker,
    every: 10,
    decimals: null,
    canMint: true,
    playable: true,
    rows: surface.rows,
    rowNote: surface.note,
    evidence: [...evidence, ...surface.evidence],
    solscan: solscan(address),
  }
}

type Surface = {
  name: string
  ticker: string
  rows: DropRow[] | null
  evidence: Evidence[]
  note: string
}

async function readProgramSurface(programId: string): Promise<Surface> {
  const idl = await readIdl(programId)
  const name = idl?.name || shortName(programId.slice(0, 4), "PROG")
  const ticker = shortName(idl?.name || programId.slice(0, 4), "PROG")
  const rows = idl && idl.instructions.length > 0 ? rowsFromInstructions(idl.instructions.map((item) => item.name)) : null
  const evidence: Evidence[] = []
  if (idl && idl.instructions.length > 0) {
    for (const instruction of idl.instructions.slice(0, 8)) {
      evidence.push({ label: "instruction", value: instruction.line, source: "anchor idl account" })
    }
    if (idl.instructions.length > 8) {
      evidence.push({
        label: "more",
        value: `${idl.instructions.length - 8} more instructions`,
        source: "anchor idl account",
      })
    }
  } else {
    evidence.push({ label: "idl", value: "none", source: `anchor idl ${idlAddress(programId)}` })
  }
  const note = rows
    ? `Crate rows are the first instructions on ${name}. Weights and the runner interval stay the cabinet defaults. The evidence lists the rest.`
    : `No Anchor IDL on ${name}. The cabinets keep their own rules and wear this program.`
  return { name, ticker, rows, evidence, note }
}

function rowsFromInstructions(instructions: string[]): DropRow[] {
  const weights = [70, 25, 5]
  const ids = ["dust", "chip", "mint"]
  return instructions.slice(0, 3).map((name, index, list) => ({
    id: index === list.length - 1 ? "mint" : ids[index],
    name,
    weight: weights[index] ?? 5,
  }))
}

type IdlInstruction = { name?: string; args?: { name?: string; type?: unknown }[]; accounts?: { name?: string }[] }

async function readIdl(programId: string): Promise<{ name: string; instructions: { name: string; line: string }[] } | null> {
  const account = await getAccount(idlAddress(programId)).catch(() => null)
  if (!account || account.data.length < 48 || account.data.length > 400_000) return null
  const text = await inflateJson(account.data)
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as { name?: unknown; instructions?: IdlInstruction[]; idl?: { name?: unknown; instructions?: IdlInstruction[] } }
    const body = parsed.instructions ? parsed : parsed.idl
    if (!body?.instructions) return null
    const instructions = body.instructions.map(formatInstruction).filter((item): item is { name: string; line: string } => item !== null)
    if (instructions.length === 0) return null
    return { name: idlTitle(body.name), instructions: instructions.slice(0, 24) }
  } catch {
    return null
  }
}

function formatInstruction(instruction: IdlInstruction): { name: string; line: string } | null {
  const name = cleanToken(instruction.name ?? "")
  if (!name) return null
  const args = (instruction.args ?? [])
    .map((arg) => {
      const argName = cleanToken(arg.name ?? "")
      const type = typeLabel(arg.type)
      if (argName && type) return `${argName}: ${type}`
      return argName || type
    })
    .filter(Boolean)
    .slice(0, 6)
  const accounts = (instruction.accounts ?? [])
    .map((account) => cleanToken(account.name ?? ""))
    .filter(Boolean)
    .slice(0, 6)
  const head = args.length > 0 ? `${name}(${args.join(", ")})` : name
  return { name, line: accounts.length > 0 ? `${head} · ${accounts.join(", ")}` : head }
}

function typeLabel(type: unknown): string {
  if (typeof type === "string") return cleanToken(type)
  if (!type || typeof type !== "object") return ""
  const key = Object.keys(type as Record<string, unknown>)[0] ?? ""
  return cleanToken(key)
}

function cleanToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, "")
}

function idlTitle(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/[^A-Za-z0-9 _.-]/g, "").trim().slice(0, 32)
}

async function readMetadataJson(uri: string): Promise<{ description?: string; external?: string; image?: string } | null> {
  const target = publicHttps(uri)
  if (!target) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const response = await fetch(target, { signal: controller.signal })
    if (!response.ok) return null
    if (!publicHttps(response.url)) return null
    const text = await response.text()
    if (text.length > 120_000 || !text.trimStart().startsWith("{")) return null
    const json = JSON.parse(text) as { description?: unknown; external_url?: unknown; image?: unknown }
    const description = typeof json.description === "string" ? json.description.replace(/\s+/g, " ").trim().slice(0, 180) : ""
    const external = typeof json.external_url === "string" ? json.external_url.trim().slice(0, 200) : ""
    const image = typeof json.image === "string" ? json.image.trim().slice(0, 200) : ""
    return {
      description: description || undefined,
      external: external || undefined,
      image: image || undefined,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function inflateJson(data: Uint8Array): Promise<string | null> {
  const starts = [44, 8, 0]
  for (const start of starts) {
    if (start >= data.length) continue
    const slice = data.slice(start)
    const inflated = await inflateText(slice)
    const text = inflated ?? new TextDecoder().decode(slice)
    const marker = text.indexOf("{")
    if (marker >= 0 && text.includes("instructions")) return text.slice(marker)
  }
  return null
}

async function inflateText(slice: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === "undefined") return null
  try {
    const stream = new Blob([Uint8Array.from(slice)]).stream().pipeThrough(new DecompressionStream("deflate"))
    return await new Response(stream).text()
  } catch {
    return null
  }
}

async function getAccountHead(address: string): Promise<Account | null> {
  const value = await rpc("getAccountInfo", [address, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }])
  if (!value || typeof value !== "object") return null
  const info = value as { owner?: string; executable?: boolean; space?: number }
  if (!info.owner) return null
  return {
    owner: info.owner,
    executable: Boolean(info.executable),
    space: info.space ?? 0,
    data: new Uint8Array(),
  }
}

async function getAccount(address: string, slice?: number): Promise<Account | null> {
  const config: { encoding: "base64"; dataSlice?: { offset: number; length: number } } = { encoding: "base64" }
  if (slice) config.dataSlice = { offset: 0, length: slice }
  const value = await rpc("getAccountInfo", [address, config])
  if (!value || typeof value !== "object") return null
  const info = value as { owner?: string; executable?: boolean; space?: number; data?: [string, string] }
  if (!info.owner) return null
  return {
    owner: info.owner,
    executable: Boolean(info.executable),
    space: info.space ?? 0,
    data: info.data?.[0] ? decodeBase64(info.data[0]) : new Uint8Array(),
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  try {
    return await Promise.any(
      ENDPOINTS.map(async (endpoint) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            signal: controller.signal,
          })
          const payload = (await response.json()) as { result?: { value?: unknown }; error?: { message?: string } }
          if (payload.error) throw new Error(payload.error.message ?? "RPC error")
          return payload.result?.value ?? null
        } finally {
          clearTimeout(timer)
        }
      }),
    )
  } catch {
    throw new Error("Mainnet RPC did not answer.")
  }
}

function solscan(address: string): string {
  return `https://solscan.io/account/${address}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
