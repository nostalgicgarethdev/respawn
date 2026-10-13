import { useMemo, useRef, useState } from "react"
import { chance, roll, type DropRow } from "./rules"

const COST = 0.1

const seed: DropRow[] = [
  { id: "dust", name: "dust", weight: 70 },
  { id: "chip", name: "chip", weight: 25 },
  { id: "mint", name: "mint", weight: 5 },
]

type Opened = { key: number; label: string; rare: boolean }

export function Crate({
  stamp,
  ticker: nextTicker,
  rows: nextRows,
}: {
  stamp: number
  ticker: string
  rows: DropRow[] | null
}) {
  const [rows, setRows] = useState<DropRow[]>(nextRows ?? seed)
  const [ticker, setTicker] = useState(nextTicker)
  const [seenStamp, setSeenStamp] = useState(stamp)
  const [balance, setBalance] = useState(2)
  const [opened, setOpened] = useState<Opened[]>([])
  const credit = useRef(2)
  const seq = useRef(0)
  const mints = useRef(0)
  if (stamp !== seenStamp) {
    setSeenStamp(stamp)
    setTicker(nextTicker)
    setRows(nextRows ?? seed)
    setOpened([])
    credit.current = 2
    setBalance(2)
    mints.current = 0
  }

  const table = useMemo(() => {
    if (nextRows) return rows
    return rows.map((row) => (row.id === "mint" ? { ...row, name: ticker.trim() || "DROP" } : row))
  }, [rows, ticker, nextRows])
  const total = table.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
  const baseline = nextRows ?? seed
  const origin = stamp === 0 ? "DROP" : nextTicker
  const dirty =
    ticker !== origin ||
    rows.some((row, index) => row.weight !== baseline[index]?.weight || row.name !== baseline[index]?.name)

  const rule = [`price = ${COST.toFixed(2)}`, ...table.map((row) => `${row.name} = ${row.weight}`)].join("\n")

  function setWeight(id: string, weight: number) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, weight } : row)))
  }

  function open() {
    if (credit.current < COST || total <= 0) return
    credit.current = Math.round((credit.current - COST) * 100) / 100
    const nextCredit = credit.current
    const row = roll(table, Math.random)
    const rare = row.id === "mint"
    if (rare) mints.current += 1
    const entry: Opened = {
      key: ++seq.current,
      label: rare ? `${row.name} #${mints.current}` : row.name,
      rare,
    }
    setBalance(nextCredit)
    setOpened((current) =>
      current.some((item) => item.key === entry.key) ? current : [entry, ...current].slice(0, 8),
    )
  }

  return (
    <section className="lab lab-flip" id="crate">
      <div className="cabinet crate-cabinet">
        <div className="cabinet-bar">
          <span>credit {balance.toFixed(2)}</span>
          <span>price {COST.toFixed(2)}</span>
          <span>rows {table.length}</span>
        </div>
        <div className="crate-stage">
          <p className="crate-last">{opened[0]?.label ?? "closed"}</p>
          <ul className="drops">
            {opened.length === 0 && <li className="muted">Open a crate.</li>}
            {opened.map((item) => (
              <li key={item.key} className={item.rare ? "rare" : undefined}>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="cabinet-actions">
          <button type="button" className="btn solid" onClick={open} disabled={balance < COST || total <= 0}>
            Open
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              credit.current = 2
              setBalance(2)
            }}
          >
            Refill 2.00
          </button>
          <p className="hint">Local credit. A mint row writes a receipt.</p>
        </div>
      </div>
      <div className="lab-copy">
        <p className="index">02</p>
        <h2>The crate</h2>
        <p>
          Weights decide the next open. The rare row is {ticker.trim() || "DROP"}. Credit on this page stays in the
          browser.
        </p>
        <label>
          Ticker
          <input
            value={ticker}
            maxLength={8}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            aria-label="Crate ticker"
          />
        </label>
        {table.map((row) => (
          <label key={row.id}>
            {row.name} {chance(row.weight, total).toFixed(1)}%
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={row.weight}
              onChange={(event) => setWeight(row.id, Number(event.target.value))}
              aria-label={`${row.name} weight`}
            />
          </label>
        ))}
        <pre className="rule">{rule}</pre>
        <p className="aside">{dirty ? "The table is yours now." : "Move a weight and the next open changes."}</p>
      </div>
    </section>
  )
}
