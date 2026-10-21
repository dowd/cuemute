import { useRef, type CSSProperties, type ReactNode } from "react";
import { paragraphText, splitSpeaker, type Paragraph, type Run, type Script } from "@cuemute/script";

// Word's highlighter colours, made see-through so text stays readable on a dark screen.
const HIGHLIGHTS: Record<string, string> = {
  yellow: "rgba(230, 216, 74, 0.35)",
  green: "rgba(92, 184, 92, 0.35)",
  cyan: "rgba(74, 200, 223, 0.35)",
  magenta: "rgba(227, 119, 194, 0.35)",
  blue: "rgba(74, 120, 223, 0.4)",
  red: "rgba(217, 83, 79, 0.4)",
  darkYellow: "rgba(180, 160, 40, 0.4)",
  darkGreen: "rgba(40, 120, 60, 0.4)",
  lightGray: "rgba(200, 200, 200, 0.25)",
};

// Script colours are chosen for white paper; lightening them keeps dark ones
// readable on the dark screen.
function runStyle(r: Run): CSSProperties | undefined {
  if (!r.colour && !r.highlight) return undefined;
  return {
    color: r.colour ? `color-mix(in srgb, #${r.colour} 70%, white)` : undefined,
    background: r.highlight ? (HIGHLIGHTS[r.highlight] ?? "rgba(230, 216, 74, 0.35)") : undefined,
  };
}

function RunText({ run }: { run: Run }) {
  let node: ReactNode = run.text;
  if (run.italic) node = <em>{node}</em>;
  if (run.bold) node = <strong>{node}</strong>;
  const style = runStyle(run);
  return style ? <span style={style}>{node}</span> : <>{node}</>;
}

// A plain text import has no bold, so the speaker's name is bolded here.
function ParagraphText({ p }: { p: Paragraph }) {
  const plain = p.style === "p" && p.runs.length === 1 && !p.runs[0]!.bold;
  if (plain) {
    const { speaker, rest } = splitSpeaker(p.runs[0]!.text);
    if (speaker) {
      return (
        <>
          <strong>{speaker}.</strong> <RunText run={{ ...p.runs[0]!, text: rest }} />
        </>
      );
    }
  }
  return (
    <>
      {p.runs.map((r, i) => (
        <RunText key={i} run={r} />
      ))}
    </>
  );
}

// The script as it reads in the source, with an outline of its headings to jump around.
export function ScriptReader({ script }: { script: Script }) {
  const box = useRef<HTMLElement>(null);
  const headings = script.paragraphs.filter((p) => p.style === "h1" || p.style === "h2");

  const jump = (id: string) => {
    const el = box.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (el && box.current) box.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  };

  return (
    <div className="reader">
      {headings.length > 0 && (
        <nav className="outline">
          {headings.map((h) => (
            <button key={h.id} className={h.style} onClick={() => jump(h.id)}>
              {paragraphText(h)}
            </button>
          ))}
        </nav>
      )}
      <article className="script" ref={box}>
        {script.paragraphs.map((p) =>
          p.style === "page" ? (
            <div key={p.id} data-id={p.id} className="para page">
              p. {paragraphText(p)}
            </div>
          ) : p.style === "row" ? (
            <div
              key={p.id}
              data-id={p.id}
              className="para row"
              style={{ gridTemplateColumns: `repeat(${p.cells?.length ?? 1}, minmax(0, 1fr))` }}
            >
              {p.cells?.map((cell, i) => (
                <span key={i}>
                  {cell.map((r, j) => (
                    <RunText key={j} run={r} />
                  ))}
                </span>
              ))}
            </div>
          ) : (
            <p key={p.id} data-id={p.id} className={`para ${p.style}`}>
              <ParagraphText p={p} />
            </p>
          ),
        )}
      </article>
    </div>
  );
}
