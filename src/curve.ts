import { decodeBase58, findPda, formatSupply } from "./account"

export const PUMP = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
const CURVE_DISC = 6966180631402821399n

export type Curve = {
  virtualToken: bigint
  virtualSol: bigint
  realToken: bigint
  realSol: bigint
  supply: bigint
  complete: boolean
}

export function curveAddress(mint: string): string {
  const program = decodeBase58(PUMP)
  const mintBytes = decodeBase58(mint)
  if (!program || !mintBytes) throw new Error("bad mint")
  return findPda([new TextEncoder().encode("bonding-curve"), mintBytes], program).address
}

export function parseCurve(data: Uint8Array): Curve | null {
  if (data.length < 49) return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  if (view.getBigUint64(0, true) !== CURVE_DISC) return null
  const supply = view.getBigUint64(40, true)
  if (supply === 0n) return null
  return {
    virtualToken: view.getBigUint64(8, true),
    virtualSol: view.getBigUint64(16, true),
    realToken: view.getBigUint64(24, true),
    realSol: view.getBigUint64(32, true),
    supply,
    complete: data[48] === 1,
  }
}

export function buy(curve: Curve, lamports: bigint): { curve: Curve; tokens: bigint } | null {
  if (curve.complete || lamports <= 0n || curve.virtualToken === 0n || curve.virtualSol === 0n) return null
  const nextSol = curve.virtualSol + lamports
  const tokens = (curve.virtualToken * lamports) / nextSol
  if (tokens === 0n || tokens > curve.realToken) return null
  return {
    tokens,
    curve: {
      ...curve,
      virtualSol: nextSol,
      virtualToken: curve.virtualToken - tokens,
      realSol: curve.realSol + lamports,
      realToken: curve.realToken - tokens,
    },
  }
}

export function sell(curve: Curve, tokens: bigint): { curve: Curve; lamports: bigint } | null {
  if (curve.complete || tokens <= 0n || curve.virtualToken === 0n || curve.virtualSol === 0n) return null
  const nextToken = curve.virtualToken + tokens
  const lamports = (curve.virtualSol * tokens) / nextToken
  if (lamports === 0n || lamports > curve.realSol) return null
  return {
    lamports,
    curve: {
      ...curve,
      virtualSol: curve.virtualSol - lamports,
      virtualToken: nextToken,
      realSol: curve.realSol - lamports,
      realToken: curve.realToken + tokens,
    },
  }
}

export function formatSpot(curve: Curve, decimals: number): string {
  if (curve.virtualToken === 0n || curve.virtualSol === 0n) return "0"
  const scale = 10n ** BigInt(decimals)
  return formatRatio(curve.virtualSol * scale, curve.virtualToken * 1_000_000_000n, 10)
}

export function formatSol(lamports: bigint): string {
  return formatSupply(lamports, 9)
}

export function curvePoints(curve: Curve, steps = 24): number[] {
  if (curve.virtualToken === 0n || curve.virtualSol === 0n || curve.realToken === 0n) {
    return curve.virtualToken === 0n ? [] : [Number(curve.virtualSol) / Number(curve.virtualToken)]
  }
  const step = curve.realToken / BigInt(steps)
  if (step === 0n) return [Number(curve.virtualSol) / Number(curve.virtualToken)]
  let sol = curve.virtualSol
  let token = curve.virtualToken
  const points = [Number(sol) / Number(token)]
  for (let index = 0; index < steps && token > step; index++) {
    const nextToken = token - step
    sol = (sol * token) / nextToken
    token = nextToken
    points.push(Number(sol) / Number(token))
  }
  return points
}

function formatRatio(numerator: bigint, denominator: bigint, places: number): string {
  if (denominator === 0n) return "0"
  const scale = 10n ** BigInt(places)
  const scaled = (numerator * scale) / denominator
  const whole = scaled / scale
  const fraction = (scaled % scale).toString().padStart(places, "0").replace(/0+$/, "")
  return fraction ? `${whole.toString()}.${fraction}` : whole.toString()
}
