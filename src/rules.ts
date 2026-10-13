export function stepSpeed(speed: number, accel: number, max: number): number {
  if (!Number.isFinite(speed) || !Number.isFinite(accel) || !Number.isFinite(max)) {
    throw new Error("speed rule needs finite numbers")
  }
  const cap = Math.max(0, max)
  return Math.min(cap, Math.max(0, speed + accel))
}

export type DropRow = {
  id: string
  name: string
  weight: number
}

export function roll(table: DropRow[], rng: () => number): DropRow {
  if (table.length === 0) {
    throw new Error("drop table is empty")
  }
  const weights = table.map((row) => Math.max(0, row.weight))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return table[0]
  let mark = rng() * total
  for (let i = 0; i < table.length; i++) {
    mark -= weights[i]
    if (mark < 0) return table[i]
  }
  return table[table.length - 1]
}

export function shouldMint(coins: number, every: number): boolean {
  if (!Number.isInteger(coins) || coins < 1) return false
  if (!Number.isInteger(every) || every < 1) return false
  return coins % every === 0
}

export function chance(weight: number, total: number): number {
  if (total <= 0 || weight <= 0) return 0
  return (weight / total) * 100
}
