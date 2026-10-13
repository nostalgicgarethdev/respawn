const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const P = 2n ** 255n - 19n
const D = mod(-121665n * modPow(121666n, P - 2n))

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
export const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
export const METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
export const UPGRADEABLE_LOADER = "BPFLoaderUpgradeab1e11111111111111111111111"

export function decodeBase58(text: string): Uint8Array | null {
  if (!text || text.length > 44) return null
  const bytes = [0]
  for (const char of text) {
    const value = ALPHABET.indexOf(char)
    if (value < 0) return null
    let carry = value
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (const char of text) {
    if (char !== "1") break
    bytes.push(0)
  }
  return Uint8Array.from(bytes.reverse())
}

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  const digits = [0]
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  return `${"1".repeat(zeros)}${digits.reverse().map((digit) => ALPHABET[digit]).join("")}`
}

export function extractAddress(input: string): string | null {
  const matches = input.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) ?? []
  for (const match of matches) {
    const bytes = decodeBase58(match)
    if (bytes?.length === 32) return encodeBase58(bytes)
  }
  return null
}

export function findPda(seeds: Uint8Array[], program: Uint8Array): { address: string; bump: number } {
  const marker = new TextEncoder().encode("ProgramDerivedAddress")
  for (let bump = 255; bump >= 0; bump--) {
    const hash = sha256(concat([...seeds, Uint8Array.of(bump), program, marker]))
    if (!isOnCurve(hash)) return { address: encodeBase58(hash), bump }
  }
  throw new Error("no program address")
}

export function metadataAddress(mint: string): string {
  const program = must32(METADATA_PROGRAM)
  return findPda(
    [new TextEncoder().encode("metadata"), program, must32(mint)],
    program,
  ).address
}

export function idlAddress(programId: string): string {
  const program = must32(programId)
  return findPda([new TextEncoder().encode("anchor:idl")], program).address
}

export type MintInfo = {
  mintAuthority: string | null
  supply: bigint
  decimals: number
  initialized: boolean
  freezeAuthority: string | null
}

export function parseMint(data: Uint8Array): MintInfo | null {
  if (data.length < 82) return null
  const mintAuthority = readOption(data, 0)
  const supply = u64(data, 36)
  const decimals = data[44]
  const initialized = data[45] === 1
  const freezeAuthority = readOption(data, 46)
  if (!initialized || decimals > 18) return null
  return { mintAuthority, supply, decimals, initialized, freezeAuthority }
}

export function parseTokenAccount(data: Uint8Array): { mint: string; owner: string; amount: bigint } | null {
  if (data.length < 72) return null
  return {
    mint: encodeBase58(data.slice(0, 32)),
    owner: encodeBase58(data.slice(32, 64)),
    amount: u64(data, 64),
  }
}

const TOKEN_METADATA_EXTENSION = 19

export function parseToken2022Metadata(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  if (data.length < 170 || data[165] !== 1) return null
  let offset = 166
  while (offset + 4 <= data.length) {
    const type = u16(data, offset)
    const length = u16(data, offset + 2)
    const start = offset + 4
    const end = start + length
    if (end > data.length) return null
    if (type === TOKEN_METADATA_EXTENSION && length >= 68) {
      try {
        const name = readBoundedString(data, start + 64, end)
        const symbol = readBoundedString(data, name.offset, end)
        const uri = readBoundedString(data, symbol.offset, end)
        if (!name.value && !symbol.value) return null
        return { name: name.value, symbol: symbol.value, uri: uri.value }
      } catch {
        return null
      }
    }
    offset = end
  }
  return null
}

export function parseMetadata(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  if (data.length < 1 + 32 + 32 + 4) return null
  if (data[0] !== 4) return null
  try {
    let offset = 1 + 32 + 32
    const name = readBorshString(data, offset)
    const symbol = readBorshString(data, name.offset)
    const uri = readBorshString(data, symbol.offset)
    if (!symbol.value && !name.value) return null
    return { name: name.value, symbol: symbol.value, uri: uri.value }
  } catch {
    return null
  }
}

export type UpgradeInfo =
  | { kind: "program"; programData: string }
  | { kind: "program-data"; slot: bigint; upgradeAuthority: string | null }

export function parseUpgradeable(data: Uint8Array): UpgradeInfo | null {
  if (data.length < 4) return null
  const tag = u32(data, 0)
  if (tag === 2 && data.length >= 36) {
    return { kind: "program", programData: encodeBase58(data.slice(4, 36)) }
  }
  if (tag === 3 && data.length >= 45) {
    const slot = u64(data, 4)
    const option = u32(data, 12)
    const upgradeAuthority = option === 1 && data.length >= 48 ? encodeBase58(data.slice(16, 48)) : null
    return { kind: "program-data", slot, upgradeAuthority }
  }
  return null
}

export function formatSupply(supply: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = supply / base
  const fraction = (supply % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return fraction ? `${grouped}.${fraction}` : grouped
}

export function shortName(value: string, fallback: string): string {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
  return cleaned || fallback
}

export function publicHttps(value: string): string | null {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== "https:") return null
  if (url.username || url.password) return null
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return null
  }
  if (isPrivateHost(host)) return null
  return url.toString()
}

function isPrivateHost(host: string): boolean {
  if (host.includes(":")) {
    const plain = host.split("%")[0]
    return plain === "::" || plain === "::1" || plain.startsWith("fc") || plain.startsWith("fd") || plain.startsWith("fe80")
  }
  const parts = host.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [first, second] = parts
  if (first === 0 || first === 10 || first === 127) return true
  if (first === 169 && second === 254) return true
  if (first === 192 && second === 168) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 100 && second >= 64 && second <= 127) return true
  return false
}

function readOption(data: Uint8Array, offset: number): string | null {
  return u32(data, offset) === 1 ? encodeBase58(data.slice(offset + 4, offset + 36)) : null
}

function readBoundedString(data: Uint8Array, offset: number, end: number): { value: string; offset: number } {
  if (offset + 4 > end) throw new Error("bad string")
  const length = u32(data, offset)
  const start = offset + 4
  if (length > 200 || start + length > end) throw new Error("bad string")
  const value = new TextDecoder().decode(data.slice(start, start + length)).replace(/\0/g, "").trim()
  return { value, offset: start + length }
}

function readBorshString(data: Uint8Array, offset: number): { value: string; offset: number } {
  const length = u32(data, offset)
  const start = offset + 4
  if (length > 512 || start + length > data.length) throw new Error("bad string")
  const value = new TextDecoder().decode(data.slice(start, start + length)).replace(/\0/g, "").trim()
  return { value, offset: start + length }
}

function u16(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true)
}

function u32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)
}

function u64(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true)
}

function must32(address: string): Uint8Array {
  const bytes = decodeBase58(address)
  if (!bytes || bytes.length !== 32) throw new Error(`bad address ${address}`)
  return bytes
}

function sha256(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8
  const padded = new Uint8Array((((bytes.length + 9 + 63) >> 6) << 6))
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padded.length - 4, bitLength)

  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const words = new Uint32Array(64)

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index++) words[index] = view.getUint32(offset + index * 4)
    for (let index = 16; index < 64; index++) {
      const s0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3)
      const s1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10)
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0
    }
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7
    for (let index = 0; index < 64; index++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const choose = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + choose + SHA_K[index] + words[index]) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  const out = new Uint8Array(32)
  const hashed = new DataView(out.buffer)
  ;[h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, index) => hashed.setUint32(index * 4, word))
  return out
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
])

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false
  let y = 0n
  for (let i = 0; i < 32; i++) y += BigInt(bytes[i]) << (8n * BigInt(i))
  const sign = (y >> 255n) & 1n
  y &= (1n << 255n) - 1n
  if (y >= P) return false
  const y2 = mod(y * y)
  const numerator = mod(y2 - 1n)
  const denominator = mod(D * y2 + 1n)
  const x2 = mod(numerator * modPow(denominator, P - 2n))
  if (x2 === 0n) return sign === 0n
  const root = sqrtMod(x2)
  return root !== null
}

function sqrtMod(value: bigint): bigint | null {
  const candidate = modPow(value, (P + 3n) / 8n)
  if (mod(candidate * candidate) === value) return candidate
  const twisted = mod(candidate * modPow(2n, (P - 1n) / 4n))
  if (mod(twisted * twisted) === value) return twisted
  return null
}

function mod(value: bigint): bigint {
  const rest = value % P
  return rest >= 0n ? rest : rest + P
}

function modPow(base: bigint, exp: bigint): bigint {
  let result = 1n
  let cursor = mod(base)
  let left = exp
  while (left > 0n) {
    if (left & 1n) result = mod(result * cursor)
    cursor = mod(cursor * cursor)
    left >>= 1n
  }
  return result
}
