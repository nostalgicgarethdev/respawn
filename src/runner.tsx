import { useEffect, useRef, useState } from "react"
import { shouldMint, stepSpeed } from "./rules"

const START = 6
const PLAYER = 26

type Bar = { kind: "bar"; x: number; w: number; h: number }
type Coin = { kind: "coin"; x: number; y: number; r: number }
type Piece = Bar | Coin

type World = {
  started: boolean
  alive: boolean
  speed: number
  coins: number
  drops: number
  y: number
  vy: number
  coyote: number
  wantJump: boolean
  pieces: Piece[]
  spawnIn: number
  tick: number
  scroll: number
}

type Hud = {
  speed: number
  coins: number
  drops: number
  phase: "idle" | "run" | "hit"
}

const idleHud: Hud = { speed: START, coins: 0, drops: 0, phase: "idle" }

export function Runner({
  stamp,
  ticker: nextTicker,
  every: nextEvery,
  drops: nextDrops,
  start = START,
  accel: nextAccel = 0.001,
  maxSpeed: nextMax = 13,
  story = "mint",
}: {
  stamp: number
  ticker: string
  every: number
  drops: boolean
  start?: number
  accel?: number
  maxSpeed?: number
  story?: "mint" | "score"
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [accel, setAccel] = useState(nextAccel)
  const [maxSpeed, setMaxSpeed] = useState(nextMax)
  const [every, setEvery] = useState(nextEvery)
  const [ticker, setTicker] = useState(nextTicker)
  const [writes, setWrites] = useState(nextDrops)
  const [seenStamp, setSeenStamp] = useState(stamp)
  const [hud, setHud] = useState<Hud>({ ...idleHud, speed: start })
  const [receipts, setReceipts] = useState<string[]>([])
  if (stamp !== seenStamp) {
    setSeenStamp(stamp)
    setTicker(nextTicker)
    setEvery(nextEvery)
    setWrites(nextDrops)
    setAccel(nextAccel)
    setMaxSpeed(nextMax)
    setReceipts([])
  }
  const rulesRef = useRef({ accel, maxSpeed, every, ticker, writes })
  rulesRef.current = { accel, maxSpeed, every, ticker, writes }
  const api = useRef({ start: () => {}, jump: () => {} })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const world: World = {
      started: false,
      alive: true,
      speed: start,
      coins: 0,
      drops: 0,
      y: 0,
      vy: 0,
      coyote: 0,
      wantJump: false,
      pieces: [],
      spawnIn: 50,
      tick: 0,
      scroll: 0,
    }

    let raf = 0
    const onResize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      canvas.height = Math.max(1, Math.floor(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    onResize()
    const observer = new ResizeObserver(onResize)
    observer.observe(canvas)

    const groundOf = () => canvas.clientHeight * 0.78

    const publish = () => {
      setHud({
        speed: world.speed,
        coins: world.coins,
        drops: world.drops,
        phase: !world.started ? "idle" : world.alive ? "run" : "hit",
      })
    }

    const reset = () => {
      world.started = true
      world.alive = true
      world.speed = START
      world.coins = 0
      world.drops = 0
      world.y = groundOf() - PLAYER
      world.vy = 0
      world.coyote = 0
      world.wantJump = false
      world.pieces = []
      world.spawnIn = 40
      world.tick = 0
      setReceipts([])
      publish()
    }

    const jump = () => {
      if (!world.started || !world.alive) {
        reset()
        return
      }
      world.wantJump = true
    }

    api.current = { start: reset, jump }

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const ground = groundOf()
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = "#10110e"
      ctx.fillRect(0, 0, w, h)

      ctx.fillStyle = "#d6ff3f"
      const offset = world.scroll % 18
      for (let x = -offset; x < w; x += 18) {
        ctx.fillRect(x, ground + 10, 8, 2)
      }
      ctx.fillRect(0, ground, w, 1)

      const py = world.started ? world.y : ground - PLAYER
      ctx.fillStyle = "#f6f3ea"
      ctx.fillRect(64, py, PLAYER, PLAYER)
      ctx.fillStyle = "#d6ff3f"
      ctx.fillRect(64 + 16, py + 6, 6, 6)

      for (const piece of world.pieces) {
        if (piece.kind === "bar") {
          ctx.fillStyle = "#f6f3ea"
          ctx.fillRect(piece.x, ground - piece.h, piece.w, piece.h)
        } else {
          ctx.fillStyle = "#d6ff3f"
          ctx.beginPath()
          ctx.arc(piece.x, piece.y, piece.r, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "#10110e"
          ctx.beginPath()
          ctx.arc(piece.x, piece.y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (!world.started || !world.alive) {
        ctx.fillStyle = "#f6f3ea"
        ctx.font = "500 13px 'IBM Plex Mono', ui-monospace, monospace"
        ctx.fillText(world.started ? "hit" : "play", 64, 28)
      }
    }

    const spawn = (ground: number, w: number) => {
      const coin = world.tick % 3 !== 0
      if (coin) {
        const lanes = [50, 76, 98]
        world.pieces.push({
          kind: "coin",
          x: w + 16,
          y: ground - lanes[world.tick % lanes.length],
          r: 8,
        })
      } else {
        world.pieces.push({
          kind: "bar",
          x: w + 16,
          w: 16,
          h: 28 + (world.tick % 2) * 18,
        })
      }
    }

    const frame = () => {
      const rules = rulesRef.current
      const w = canvas.clientWidth
      const ground = groundOf()

      if (world.started && world.alive) {
        world.tick += 1
        world.speed = stepSpeed(world.speed, rules.accel, rules.maxSpeed)
        world.scroll += world.speed

        if (world.y + PLAYER >= ground - 0.5) {
          world.y = ground - PLAYER
          world.vy = 0
          world.coyote = 8
        } else {
          world.coyote = Math.max(0, world.coyote - 1)
        }

        if (world.wantJump && world.coyote > 0) {
          world.vy = -8.6
          world.coyote = 0
          world.wantJump = false
        } else {
          world.wantJump = false
        }

        world.vy += 0.38
        world.y += world.vy
        if (world.y + PLAYER > ground) {
          world.y = ground - PLAYER
          world.vy = 0
        }

        world.spawnIn -= 1
        if (world.spawnIn <= 0) {
          spawn(ground, w)
          world.spawnIn = Math.max(34, Math.round(76 - world.speed * 2))
        }

        const next: Piece[] = []
        for (const piece of world.pieces) {
          piece.x -= world.speed
          if (piece.kind === "bar") {
            const left = 64
            const right = 64 + PLAYER
            const top = world.y
            const bottom = world.y + PLAYER
            const hit =
              right > piece.x &&
              left < piece.x + piece.w &&
              bottom > ground - piece.h &&
              top < ground
            if (hit) world.alive = false
          } else {
            const nearestX = Math.max(64, Math.min(piece.x, 64 + PLAYER))
            const nearestY = Math.max(world.y, Math.min(piece.y, world.y + PLAYER))
            const dx = piece.x - nearestX
            const dy = piece.y - nearestY
            if (dx * dx + dy * dy <= piece.r * piece.r) {
              world.coins += 1
              if (rules.writes && shouldMint(world.coins, rules.every)) {
                world.drops += 1
                const label = `${rules.ticker.trim() || "DROP"} #${world.drops}`
                setReceipts((prev) => [label, ...prev].slice(0, 6))
              }
              continue
            }
          }
          if (piece.x > -40) next.push(piece)
        }
        world.pieces = next
        if (world.tick % 4 === 0) publish()
        if (!world.alive) publish()
      }

      draw()
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)

    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "ArrowUp") return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return
      }
      event.preventDefault()
      jump()
    }
    window.addEventListener("keydown", onKey)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener("keydown", onKey)
    }
  }, [stamp, start])

  const name = ticker.trim() || "DROP"
  const dirty = accel !== nextAccel || maxSpeed !== nextMax || every !== nextEvery || ticker !== nextTicker || writes !== nextDrops
  const rule = writes
    ? `start = ${start}
accel = ${accel}
max = ${maxSpeed}
coin = 1 ${name}
mint every ${every} coins`
    : `start = ${start}
accel = ${accel}
max = ${maxSpeed}
coin = 1 ${name}
drops = off`

  return (
    <section className="lab" id="runner">
      <div className="lab-copy">
        <p className="index">01</p>
        <h2>The runner</h2>
        <p>
          {story === "score"
            ? `It starts at ${start} and adds ${accel} until ${maxSpeed}. That speed rule is the one on the page. Coins are score.`
            : writes
              ? `It starts at ${start} and climbs. Every ${every} coins writes one ${name}. That interval is the mint decimals.`
              : `It starts at ${start} and climbs. Coins score ${name}. The mint authority is revoked, so a coin does not write a drop.`}
        </p>
        <label>
          Ticker
          <input
            value={ticker}
            maxLength={8}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            aria-label="Runner ticker"
          />
        </label>
        <label>
          Acceleration {accel.toFixed(3)}
          <input
            type="range"
            min={0}
            max={0.02}
            step={0.001}
            value={accel}
            onChange={(event) => setAccel(Number(event.target.value))}
            aria-label="Acceleration"
          />
        </label>
        <label>
          Max speed {maxSpeed}
          <input
            type="range"
            min={8}
            max={20}
            step={1}
            value={maxSpeed}
            onChange={(event) => setMaxSpeed(Number(event.target.value))}
            aria-label="Max speed"
          />
        </label>
        {writes && (
          <label>
            Mint every {every} coins
            <input
              type="range"
              min={3}
              max={20}
              step={1}
              value={every}
              onChange={(event) => setEvery(Number(event.target.value))}
              aria-label="Coins per mint"
            />
          </label>
        )}
        <pre className="rule">{rule}</pre>
        <p className="aside">{dirty ? "These numbers are yours now." : "Move a number and the cabinet follows."}</p>
        {receipts.length > 0 && (
          <ul className="receipts">
            {receipts.map((receipt) => (
              <li key={receipt}>{receipt}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="cabinet">
        <div className="cabinet-bar">
          <span>speed {hud.speed.toFixed(1)}</span>
          <span>coins {hud.coins}</span>
          <span>{writes ? `drops ${hud.drops}` : "drops off"}</span>
        </div>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            writes
              ? `Runner. Speed ${hud.speed.toFixed(1)}, ${hud.coins} ${hud.coins === 1 ? "coin" : "coins"}, ${hud.drops} ${hud.drops === 1 ? "drop" : "drops"}.`
              : `Runner. Speed ${hud.speed.toFixed(1)}, ${hud.coins} ${hud.coins === 1 ? "coin" : "coins"}. Drops are off.`
          }
        />
        <div className="cabinet-actions">
          <button type="button" className="btn solid" onClick={() => api.current.start()}>
            {hud.phase === "idle" ? "Play" : "Restart"}
          </button>
          <button type="button" className="btn" onClick={() => api.current.jump()}>
            Jump
          </button>
          <p className="hint">{writes ? "Space jumps. A hit keeps the rule." : "Space jumps. Coins score. Nothing is minted."}</p>
        </div>
      </div>
    </section>
  )
}
