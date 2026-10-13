import { useEffect, useState } from "react"
import { publicHttps } from "./account"
import { CurveGame } from "./curveGame"
import { readGame, type GameRead } from "./readGame"
import { Remake } from "./remake"
import { Runner } from "./runner"

const SAMPLES = [
  ["A page", "https://example.com/"],
  ["A coin", "https://pump.fun/coin/EKtmPPLaCbEEKiwoHHtV7TsRsmPXs5CMGtQtZFSiinsc"],
] as const

export function App() {
  const [query, setQuery] = useState("")
  const [reading, setReading] = useState(false)
  const [error, setError] = useState("")
  const [read, setRead] = useState<GameRead | null>(null)
  const [stamp, setStamp] = useState(0)

  async function run(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      setError("Paste a public link.")
      return
    }
    setReading(true)
    setError("")
    try {
      const body = await readGame(trimmed)
      setRead(body)
      setStamp((current) => current + 1)
      setQuery(trimmed)
      const next = new URL(window.location.href)
      next.searchParams.set("q", trimmed)
      window.history.replaceState(null, "", next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Read failed")
    } finally {
      setReading(false)
    }
  }

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q")
    if (!initial) return
    setQuery(initial)
    void run(initial)
  }, [])

  const title = read?.name ?? ""

  return (
    <>
      <header className="top">
        <a className="mark" href="#top">
          Respawn
        </a>
        <nav>
          <a href="#remake">Remake</a>
          {read?.play === "curve" && <a href="#trade">Trade</a>}
          {read?.play === "runner" && <a href="#runner">Runner</a>}
          {(read?.play === "page" || (read?.play === "runner" && read.evidence.some((item) => item.label === "heading" || item.label === "script" || item.label === "form"))) && (
            <a href="#works">Page</a>
          )}
          {read?.play === "chain" && <a href="#works">Account</a>}
          {read && <a href="#evidence">Evidence</a>}
        </nav>
      </header>
      <main id="top">
        <section className="hero">
          <p className="kicker">{read ? read.kind : "Remake"}</p>
          <h1 className={read && title.length > 22 ? "long" : undefined}>
            {read ? <em>{read.name}</em> : <em>A link.</em>}
          </h1>
          <p className="lede">
            {read
              ? read.rowNote
              : "Paste a public link. The remake stays on this page."}
          </p>
        </section>

        <section className="reader" id="remake">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(query)
            }}
          >
            <input
              className="query"
              value={query}
              placeholder="Paste a link"
              aria-label="Public link"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="btn solid" disabled={reading}>
              {reading ? "Reading" : "Remake"}
            </button>
          </form>
          <div className="samples">
            {SAMPLES.map(([label, address]) => (
              <button key={address} type="button" onClick={() => void run(address)} disabled={reading}>
                {label}
              </button>
            ))}
          </div>
          {reading && <p className="aside">Reading the link.</p>}
          {error && <p className="error">{error}</p>}
        </section>

        {read?.play === "curve" && read.curve && (
          <CurveGame key={`curve-${stamp}`} ticker={read.ticker} decimals={read.decimals} curve={read.curve} />
        )}
        {read?.play === "runner" && read.speed && (
          <Runner
            key={`runner-${stamp}`}
            stamp={stamp}
            ticker={read.ticker}
            every={read.every}
            drops={false}
            start={read.speed.start}
            accel={read.speed.accel}
            maxSpeed={read.speed.max}
            story="score"
          />
        )}
        {read && (
          <>
            <Remake read={read} />
            <Evidence read={read} />
          </>
        )}

        {!read && (
          <>
            <p className="stage">The remake shows up here.</p>
            <section className="steps" id="how">
              <ol>
                <li>
                  <span>01</span>
                  <strong>Paste a public link.</strong>
                  <p>A site, a coin page, or a Solana address.</p>
                </li>
                <li>
                  <span>02</span>
                  <strong>The page reads it.</strong>
                  <p>Title, text, headings, and the scripts that page loads.</p>
                </li>
                <li>
                  <span>03</span>
                  <strong>The remake is here.</strong>
                  <p>A printed rule can be played. A normal page is rebuilt from the parts that were read.</p>
                </li>
              </ol>
            </section>
          </>
        )}
      </main>
      <footer>
        <p>
          Paste a public link. The remake stays on this page. Play stays in the browser.
        </p>
      </footer>
    </>
  )
}

function Evidence({ read }: { read: GameRead }) {
  return (
    <section className="targets" id="evidence">
      <h2>Where this came from</h2>
      <ul className="evidence">
        {read.evidence.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span>{item.label}</span>
            <strong>
              <EvidenceValue value={item.value} />
              <br />
              <span>{item.source}</span>
            </strong>
          </li>
        ))}
      </ul>
      {read.solscan && (
        <p className="aside">
          <a href={read.solscan}>Solscan</a>
        </p>
      )}
    </section>
  )
}

function EvidenceValue({ value }: { value: string }) {
  const href = publicHttps(value)
  if (!href) return <>{value}</>
  return <a href={href}>{value}</a>
}


