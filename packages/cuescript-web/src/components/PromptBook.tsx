import { useRef, useState, type Ref } from "react";
import { MUTES, paragraphText, type Cue, type Note, type Paragraph, type ProductionView, type Script } from "@cuemute/script";
import { cueLabel, departmentOf } from "../cues.ts";
import { formatted, paragraphWords } from "../render.tsx";
import { useProduction } from "../useProduction.ts";
import { useScript } from "../useScript.ts";

type Paper = "A4" | "letter";

interface Options {
  hidden: string[]; // departments left out; new departments show by default
  notes: boolean;
  paper: Paper;
}

// Choices live in the URL, so a printed prompt book can be opened the same way again.
function readOptions(): Options {
  const q = new URLSearchParams(location.search);
  return {
    hidden: (q.get("hide") ?? "").split(",").filter(Boolean),
    notes: q.get("notes") !== "0",
    paper: q.get("paper") === "letter" ? "letter" : "A4",
  };
}

function writeOptions(id: string, o: Options): void {
  const parts = [`p=${encodeURIComponent(id)}`, "print"];
  if (o.hidden.length) parts.push(`hide=${o.hidden.join(",")}`);
  if (!o.notes) parts.push("notes=0");
  if (o.paper !== "A4") parts.push(`paper=${o.paper}`);
  history.replaceState(null, "", `?${parts.join("&")}`);
}

const fileName = (name: string) => `${name.replace(/[^\w -]+/g, "").trim() || "prompt book"} prompt book.html`;

// The prompt book to print or save: the script with each cue in the margin
// beside its line and marked on its word, and notes under their lines.
export function PromptBook({ id }: { id: string }) {
  const state = useProduction(id);
  const production = state.status === "ready" ? state.production : null;
  const script = useScript(id, production?.script ?? null);
  const [options, setOptions] = useState(readOptions);
  const book = useRef<HTMLDivElement>(null);

  if (state.status === "gone") return <div className="loading">{state.message}.</div>;
  if (!production) return <div className="loading">Connecting to cuescript…</div>;
  if (!production.script) return <div className="loading">This production has no script yet.</div>;
  if (!script) return <div className="loading">Loading the script…</div>;

  const set = (patch: Partial<Options>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    writeOptions(id, next);
  };

  // one file that opens anywhere: the page's styles, and the prompt book
  const download = () => {
    const css = [...document.styleSheets]
      .flatMap((sheet) => {
        try {
          return [...sheet.cssRules].map((r) => r.cssText);
        } catch {
          return [];
        }
      })
      .join("\n");
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${production.name} prompt book</title>
<style>${css}
body { margin: 0; background: #fff; }</style>
<style>${pageRule(options.paper)}</style>
</head>
<body>${book.current?.outerHTML ?? ""}</body>
</html>
`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = fileName(production.name);
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="book-page">
      <style>{pageRule(options.paper)}</style>
      <div className="book-controls">
        <strong>Prompt book</strong>
        <span className="group">
          {production.departments.map((d) => (
            <label key={d.id} className="check">
              <input
                type="checkbox"
                checked={!options.hidden.includes(d.id)}
                onChange={(e) =>
                  set({ hidden: e.target.checked ? options.hidden.filter((x) => x !== d.id) : [...options.hidden, d.id] })
                }
              />
              <span className="swatch" style={{ background: d.colour }} />
              {d.code || d.name}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={options.notes} onChange={(e) => set({ notes: e.target.checked })} />
            Notes
          </label>
        </span>
        <select value={options.paper} onChange={(e) => set({ paper: e.target.value as Paper })} aria-label="Paper">
          <option value="A4">A4</option>
          <option value="letter">Letter</option>
        </select>
        <button onClick={() => window.print()}>Print or save as PDF</button>
        <button onClick={download}>Download HTML</button>
      </div>
      <Book ref={book} production={production} script={script} options={options} />
    </div>
  );
}

function pageRule(paper: Paper): string {
  return `@page { size: ${paper === "letter" ? "letter" : "A4"} portrait; margin: 14mm 12mm; }`;
}

interface BookProps {
  production: ProductionView;
  script: Script;
  options: Options;
  ref: Ref<HTMLDivElement>;
}

function Book({ production: p, script, options, ref }: BookProps) {
  const shown = (c: Cue) => !options.hidden.includes(departmentOf(c, p.departments)?.id ?? "");
  const cues = p.cues.filter(shown);
  const notes = options.notes ? p.notes : [];

  const cuesIn = new Map<string, Cue[]>();
  for (const c of cues) if (c.at) cuesIn.set(c.at.paragraph, [...(cuesIn.get(c.at.paragraph) ?? []), c]);
  const notesIn = new Map<string, Note[]>();
  for (const n of notes) if (n.at) notesIn.set(n.at.paragraph, [...(notesIn.get(n.at.paragraph) ?? []), n]);
  const unplaced = [...cues.filter((c) => !c.at), ...notes.filter((n) => !n.at)];
  const departments = p.departments.filter((d) => !options.hidden.includes(d.id));

  const colour = (c: Cue) => departmentOf(c, p.departments)?.colour;
  const name = (c: Cue) => (c.kind === "mute" ? c.name : c.label);
  // on paper a scene number alone could be anything, so mute cues say so
  const mutesCode = p.departments.find((d) => d.id === MUTES)?.code || "Mute";
  const label = (c: Cue) => (c.kind === "mute" ? `${mutesCode} ${cueLabel(c, p.departments)}` : cueLabel(c, p.departments));

  const paragraph = (para: Paragraph) => {
    if (para.style === "page") {
      return (
        <div key={para.id} className="b-para page">
          p. {paragraphText(para)}
        </div>
      );
    }
    if (para.style === "row") {
      return (
        <div key={para.id} className="b-para row">
          <div className="b-margin" />
          <div className="b-cells" style={{ gridTemplateColumns: `repeat(${para.cells?.length ?? 1}, minmax(0, 1fr))` }}>
            {para.cells?.map((cell, i) => <span key={i}>{cell.map((r, j) => formatted(r, r.text, j, true))}</span>)}
          </div>
        </div>
      );
    }
    const here = (cuesIn.get(para.id) ?? []).sort((a, b) => a.at!.word - b.at!.word);
    const marked = new Map(here.map((c) => [c.at!.word, c]));
    return (
      <div key={para.id} className={`b-para ${para.style}`}>
        <div className="b-margin">
          {here.map((c) => (
            <div key={c.id} className="b-cue" style={{ borderLeftColor: colour(c) }}>
              <strong>{label(c)}</strong>{" "}
              {name(c)}
              {c.kind === "cue" && c.notes && <div className="b-cue-notes">{c.notes}</div>}
            </div>
          ))}
        </div>
        <div className="b-text">
          {paragraphWords(
            para,
            (w, text, key, end) => {
              const c = marked.get(w);
              return c ? (
                <span key={key} className="b-word" style={{ textDecorationColor: colour(c) }}>
                  {text}
                  {end && <sup style={{ color: colour(c) }}>{cueLabel(c, p.departments)}</sup>}
                </span>
              ) : (
                <span key={key}>{text}</span>
              );
            },
            true,
          )}
          {(notesIn.get(para.id) ?? []).map((n) => (
            <div key={n.id} className="b-note">
              {n.text}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="book" ref={ref}>
      <div className="b-head">
        <h1>{p.name}</h1>
        <p>
          {script.name} · printed {new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <p className="b-legend">
          {departments.map((d) => (
            <span key={d.id}>
              <span className="swatch" style={{ background: d.colour }} /> {d.code ? `${d.code} ` : ""}
              {d.name}
            </span>
          ))}
        </p>
      </div>
      {script.paragraphs.map(paragraph)}
      {unplaced.length > 0 && (
        <section className="b-unplaced">
          <h2>Not placed</h2>
          <p>A new version of the script lost the words these went on.</p>
          <ul>
            {unplaced.map((x) =>
              "kind" in x ? (
                <li key={x.id}>
                  <strong>{label(x)}</strong> {name(x)}
                </li>
              ) : (
                <li key={x.id}>Note: {x.text}</li>
              ),
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
