import { useEffect, useState } from "react"
import { publicHttps } from "./account"
import { CurveGame } from "./curveGame"
import { readGame, type GameRead } from "./readGame"
import { Remake } from "./remake"
import { Runner } from "./runner"

const SAMPLES = [
  ["A page", "https://example.com/"],
  ["A coin", "https://pump.fun/coin/EKtmPPLaCbEEKiwoHHtV7TsRsmPXs5CMGtQtZFSiinsc"],
  ["Hacker News", "https://news.ycombinator.com/"],
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
          <svg className="mark-icon" viewBox="0 0 32 32" aria-hidden="true"><rect x="1.5" y="1.5" width="29" height="29" rx="3" fill="#d6ff3f" stroke="#16150f" strokeWidth="3"/><text x="16" y="25" textAnchor="middle" fontFamily="Instrument Serif, Georgia, serif" fontSize="26" fill="#16150f" transform="translate(32 0) scale(-1 1)">R</text></svg>
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
          <p className="kicker">{read ? read.kind : "Reverse anything"}</p>
          <h1 className={read && title.length > 22 ? "long" : undefined}>
            {read ? <em>{read.name}</em> : <>Take it apart. <em>Put it back.</em></>}
          </h1>
          <p className="lede">
            {read
              ? read.rowNote
              : "A small reverse engineering app for everyday stuff. Paste a public web page, a pump.fun coin or a Solana address. Respawn reads the public data and rebuilds it here as something you can poke at."}
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
            <span className="tag">Public data only</span>
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
            <section className="intro" id="what">
              <p className="kicker">What Respawn does</p>
              <p className="intro-big">
                Respawn reads a public web page, a pump.fun coin page, or a Solana address, and remakes it here as a sandbox you can play with.
              </p>
              <p className="intro-sub">
                It only reads what is already public: the page itself and on-chain account data. It does not run the page's scripts, log in, or touch your wallet. Anything you do in the remake happens in your browser and nowhere else.
              </p>
            </section>
            <section className="steps four" id="how">
              <h2>How it works</h2>
              <ol>
                <li>
                  <span>01</span>
                  <strong>Paste a public link.</strong>
                  <p>An https web page, a pump.fun coin page, or a Solana address.</p>
                </li>
                <li>
                  <span>02</span>
                  <strong>Respawn reads it.</strong>
                  <p>For a page: the title, description, headings, forms, and which scripts it loads. Scripts are listed, never run. For a coin or address: the public account data on Solana.</p>
                </li>
                <li>
                  <span>03</span>
                  <strong>It remakes it.</strong>
                  <p>A pump.fun coin becomes its bonding curve, which you can buy and sell against with pretend SOL. A page that prints a speed rule becomes a small runner game. Any other page is rebuilt from its parts.</p>
                </li>
                <li>
                  <span>04</span>
                  <strong>You see the sources.</strong>
                  <p>Every line in the remake shows where it was read from, with a Solscan link for on-chain data.</p>
                </li>
              </ol>
            </section>
            <section className="faq" id="faq">
              <h2>Questions</h2>
              <dl>
                <dt>Is this real trading?</dt>
                <dd>No. The curve uses the coin's real numbers, but every buy and sell is local maths in your browser. No transaction is sent and no coin is minted.</dd>
                <dt>Does it need my wallet?</dt>
                <dd>No. There is no wallet connect and nothing to sign. Respawn never asks for keys or funds.</dd>
                <dt>What links work?</dt>
                <dd>Public https web pages, pump.fun coin links (pump.fun/coin/...), and Solana addresses. Private, local, or logged-in pages are refused.</dd>
                <dt>Does it copy the site?</dt>
                <dd>No. It reads the public parts of one page and shows a simple remake with sources. It does not download code, run scripts, or get around logins or protections.</dd>
              </dl>
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


