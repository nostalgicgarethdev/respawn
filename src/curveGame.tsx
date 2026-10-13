import { useEffect, useRef, useState } from "react"
import { formatSupply } from "./account"
import { buy, curvePoints, formatSol, formatSpot, sell, type Curve } from "./curve"

const COST = 100_000_000n

export function CurveGame({
  ticker,
  decimals,
  curve: start,
}: {
  ticker: string
  decimals: number
  curve: Curve
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const book = useRef({ curve: start, credit: 2_000_000_000n, tokens: 0n })
  const [credit, setCredit] = useState(book.current.credit)
  const [tokens, setTokens] = useState(book.current.tokens)
  const [curve, setCurve] = useState(start)
  const [fills, setFills] = useState<string[]>([])
  const [note, setNote] = useState("")
  const finished = curve.complete || curve.virtualToken === 0n
  const price = formatSpot(curve, decimals)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#10110e"
    ctx.fillRect(0, 0, width, height)
    const points = curvePoints(curve)
    if (points.length < 2) return
    const min = Math.min(...points)
    const max = Math.max(...points)
    const span = max - min || 1
    ctx.beginPath()
    points.forEach((point, index) => {
      const x = (index / (points.length - 1)) * (width - 24) + 12
      const y = height - 16 - ((point - min) / span) * (height - 36)
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = "#d6ff3f"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = "#f6f3ea"
    ctx.beginPath()
    ctx.arc(12, height - 16 - ((points[0] - min) / span) * (height - 36), 4, 0, Math.PI * 2)
    ctx.fill()
  }, [curve])

  function trade(side: "buy" | "sell") {
    const current = book.current
    if (side === "buy") {
      if (current.credit < COST) {
        setNote("Not enough credit.")
        return
      }
      const next = buy(current.curve, COST)
      if (!next) {
        setNote("The curve can't fill 0.10 SOL.")
        return
      }
      book.current = {
        curve: next.curve,
        credit: current.credit - COST,
        tokens: current.tokens + next.tokens,
      }
      setFills((items) => [`buy ${formatSupply(next.tokens, decimals)} ${ticker}`, ...items].slice(0, 6))
    } else {
      if (current.tokens === 0n) return
      const next = sell(current.curve, current.tokens)
      if (!next) {
        setNote("The curve can't buy that back.")
        return
      }
      book.current = { curve: next.curve, credit: current.credit + next.lamports, tokens: 0n }
      setFills((items) => [`sell ${formatSol(next.lamports)} SOL`, ...items].slice(0, 6))
    }
    setCurve(book.current.curve)
    setCredit(book.current.credit)
    setTokens(book.current.tokens)
    setNote("")
  }

  const rule = `virtual sol = ${formatSol(curve.virtualSol)}
virtual tokens = ${formatSupply(curve.virtualToken, decimals)}
price = ${price} SOL
buy = 0.10 SOL
fee = none`

  return (
    <section className="lab" id="trade">
      <div className="lab-copy">
        <p className="index">01</p>
        <h2>The curve</h2>
        <p>
          {finished
            ? "The coin account says this curve is complete. There is no open trade to replay."
            : `A buy adds SOL and takes ${ticker} off the curve. The price is the virtual reserves on the account.`}
        </p>
        <pre className="rule">{rule}</pre>
        <p className="aside">The reserves move only in this browser.</p>
        {note && <p className="error">{note}</p>}
        {fills.length > 0 && (
          <ul className="receipts">
            {fills.map((fill, index) => (
              <li key={`${fill}-${index}`}>{fill}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="cabinet">
        <div className="cabinet-bar">
          <span>credit {formatSol(credit)}</span>
          <span>
            {ticker} {formatSupply(tokens, decimals)}
          </span>
          <span>{finished ? "complete" : "open"}</span>
        </div>
        <div className="crate-stage">
          <p className="crate-last">{price}</p>
        </div>
        <canvas ref={canvasRef} role="img" aria-label={`Curve price ${price} SOL per ${ticker}.`} />
        <div className="cabinet-actions">
          <button type="button" className="btn solid" onClick={() => trade("buy")} disabled={finished || credit < COST}>
            Buy 0.10
          </button>
          <button type="button" className="btn" onClick={() => trade("sell")} disabled={finished || tokens === 0n}>
            Sell
          </button>
          <p className="hint">Local SOL. Not a chain trade.</p>
        </div>
      </div>
    </section>
  )
}
