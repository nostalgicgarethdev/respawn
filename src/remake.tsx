import type { GameRead } from "./readGame"
import { sheetFor } from "./explain"

export function Remake({ read }: { read: GameRead }) {
  const sheet = sheetFor(read)
  if (!sheet) return null
  return (
    <section className="lab" id="works">
      <div className="lab-copy">
        <p className="index">{sheet.kicker}</p>
        <h2>{sheet.title}</h2>
        {sheet.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <article className="sheet">
        <h3>{read.name}</h3>
        {sheet.text && <p>{sheet.text}</p>}
        {sheet.headings.map((heading) => (
          <h4 key={heading}>{heading}</h4>
        ))}
        {sheet.fields.map((field) => (
          <p className="field" key={`${field.label}-${field.value}`}>
            <span>{field.label}</span>
            {field.value}
          </p>
        ))}
        {sheet.forms.map((form) => (
          <p className="field" key={form}>
            <span>form</span>
            {form}
          </p>
        ))}
        {sheet.scripts.length > 0 && (
          <ul>
            {sheet.scripts.map((script, index) => (
              <li key={`${script}-${index}`}>{script}</li>
            ))}
          </ul>
        )}
      </article>
    </section>
  )
}
