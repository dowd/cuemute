import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  paragraphText,
  splitSpeaker,
  type Cue,
  type LinkState,
  type MuteCue,
  type Note,
  type Paragraph,
  type ProductionView,
  type Run,
  type Script,
} from "@cuemute/script";
import { cueLabel, cueTitle, departmentOf, isSelected, type Selection, type WordAt } from "../cues.ts";
import type { Run as RunAction } from "../useRun.ts";
import { WordActions } from "./WordActions.tsx";

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

function formatted(run: Run, node: ReactNode, key: number): ReactNode {
  if (run.italic) node = <em>{node}</em>;
  if (run.bold) node = <strong>{node}</strong>;
  return (
    <span key={key} style={runStyle(run)}>
      {node}
    </span>
  );
}

// A plain text import has no bold, so the speaker's name is bolded here.
function displayRuns(p: Paragraph): Run[] {
  if (p.style !== "p" || p.runs.length !== 1 || p.runs[0]!.bold) return p.runs;
  const { speaker, rest } = splitSpeaker(p.runs[0]!.text);
  return speaker ? [{ text: `${speaker}. `, bold: true }, { ...p.runs[0]!, text: rest }] : p.runs;
}

interface Props {
  script: Script;
  production: ProductionView;
  link: LinkState;
  // the Cues panel is open on this screen, so words can be picked
  editing: boolean;
  selection: Selection;
  onSelect: (s: Selection) => void;
  run: RunAction;
}

// The script as it reads in the source, with every cue marked on its word and
// in the margin, and notes under their lines. While cuemute is linked, it keeps
// the next scene's cue in view until the reader scrolls by hand. With the Cues
// panel open, selecting a word offers what can be done there.
export function ScriptReader({ script, production, link, editing, selection, onSelect, run }: Props) {
  const box = useRef<HTMLElement>(null);
  const [following, setFollowing] = useState(true);
  const [picked, setPicked] = useState<WordAt | null>(null);
  const { cues, notes, departments } = production;
  const headings = script.paragraphs.filter((p) => p.style === "h1" || p.style === "h2");
  const current = link.status === "connected" ? link.current : null;
  const next = link.status === "connected" ? link.next : null;
  const paragraphIndex = new Map(script.paragraphs.map((p, i) => [p.id, i]));

  const cuesIn = new Map<string, Cue[]>();
  for (const c of cues) if (c.at) cuesIn.set(c.at.paragraph, [...(cuesIn.get(c.at.paragraph) ?? []), c]);
  const notesIn = new Map<string, Note[]>();
  for (const n of notes) if (n.at) notesIn.set(n.at.paragraph, [...(notesIn.get(n.at.paragraph) ?? []), n]);
  const sceneCue = new Map(cues.flatMap((c) => (c.kind === "mute" ? [[c.scene, c] as const] : [])));

  // the next scene's cue, or the nearest placed scene before it in cuemute's order
  let follow: MuteCue | undefined;
  if (link.status === "connected") {
    for (let i = link.scenes.findIndex((s) => s.id === (next ?? current)); i >= 0 && !follow; i--) {
      follow = sceneCue.get(link.scenes[i]!.id);
    }
  }
  // while editing, the selected item's line
  const selectedAt =
    editing && selection
      ? selection.kind === "scene"
        ? sceneCue.get(selection.id)?.at
        : selection.kind === "cue"
          ? cues.find((c) => c.id === selection.id)?.at
          : notes.find((n) => n.id === selection.id)?.at
      : undefined;
  const target = selectedAt?.paragraph ?? follow?.at.paragraph;

  useEffect(() => {
    const el = target && box.current?.querySelector<HTMLElement>(`[data-id="${target}"]`);
    if (!following || !el || !box.current) return;
    box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 3, behavior: "smooth" });
  }, [target, following, script]);

  useEffect(() => setPicked(null), [editing, script]);

  const jump = (id: string) => {
    setFollowing(false);
    const el = box.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (el && box.current) box.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  };

  const cueClass = (c: Cue) =>
    [
      c.kind === "mute" && c.scene === next && "next",
      c.kind === "mute" && c.scene === current && "current",
      isSelected(selection, c) && "selected",
    ]
      .filter(Boolean)
      .join(" ");

  const select = (c: Cue) => {
    const s: Selection = c.kind === "mute" ? { kind: "scene", id: c.scene } : { kind: "cue", id: c.id };
    onSelect(isSelected(selection, c) ? null : s);
  };

  // each word in a span, numbered as the server numbers them
  const words = (p: Paragraph, marks: Map<number, Cue[]>) => {
    let word = -1;
    let afterSpace = true;
    return displayRuns(p).map((run, ri) => {
      const parts = run.text.split(/(\s+)/).map((part, pi) => {
        if (!part) return null;
        if (/^\s+$/.test(part)) {
          afterSpace = true;
          return part;
        }
        // a word split across two runs keeps one number
        if (afterSpace) word++;
        afterSpace = false;
        const w = word;
        const here = marks.get(w);
        const first = here?.[0];
        const isPicked = picked?.paragraph === p.id && picked.word === w;
        const classes = ["w", first && "cued", first && cueClass(first), isPicked && "picked"];
        const colour = first?.kind === "cue" ? departmentOf(first, departments)?.colour : undefined;
        return (
          <span
            key={pi}
            className={classes.filter(Boolean).join(" ")}
            style={colour ? { textDecorationColor: colour } : undefined}
            onClick={editing ? () => setPicked(isPicked ? null : { paragraph: p.id, word: w }) : undefined}
          >
            {part}
          </span>
        );
      });
      return formatted(run, parts, ri);
    });
  };

  const paragraph = (p: Paragraph) => {
    if (p.style === "page") {
      return (
        <div key={p.id} data-id={p.id} className="para page">
          p. {paragraphText(p)}
        </div>
      );
    }
    if (p.style === "row") {
      return (
        <div
          key={p.id}
          data-id={p.id}
          className="para row"
          style={{ gridTemplateColumns: `repeat(${p.cells?.length ?? 1}, minmax(0, 1fr))` }}
        >
          {p.cells?.map((cell, i) => <span key={i}>{cell.map((r, j) => formatted(r, r.text, j))}</span>)}
        </div>
      );
    }
    const here = (cuesIn.get(p.id) ?? []).sort((a, b) => a.at!.word - b.at!.word);
    const marks = new Map<number, Cue[]>();
    for (const c of here) marks.set(c.at!.word, [...(marks.get(c.at!.word) ?? []), c]);
    const classes = [
      "para",
      p.style,
      here.some((c) => c.kind === "mute" && c.scene === next) && "next",
      here.some((c) => c.kind === "mute" && c.scene === current) && "current",
      editing && "pickable",
    ];
    return (
      <div key={p.id} data-id={p.id} className={classes.filter(Boolean).join(" ")}>
        <div className="cues">
          {here.map((c) => {
            const colour = departmentOf(c, departments)?.colour;
            return (
              <button
                key={c.id}
                className={`cue ${c.kind === "cue" ? "dept" : ""} ${cueClass(c)}`}
                style={{ borderLeftColor: colour, color: c.kind === "cue" ? colour : undefined }}
                title={cueTitle(c)}
                disabled={!editing}
                onClick={() => select(c)}
              >
                {cueLabel(c, departments)}
              </button>
            );
          })}
        </div>
        <div className="text">
          {words(p, marks)}
          {here
            .filter((c) => c.kind === "cue" && c.label)
            .map((c) => (
              <span key={c.id} className="cue-label" style={{ color: departmentOf(c, departments)?.colour }}>
                {cueLabel(c, departments)}: {c.kind === "cue" && c.label}
              </span>
            ))}
        </div>
        {(notesIn.get(p.id) ?? []).map((n) => (
          <button
            key={n.id}
            className={`line-note ${isSelected(selection, n) ? "selected" : ""}`}
            disabled={!editing}
            onClick={() => onSelect(isSelected(selection, n) ? null : { kind: "note", id: n.id })}
          >
            {n.text || <em>Empty note</em>}
          </button>
        ))}
        {editing && picked?.paragraph === p.id && (
          <WordActions
            production={production}
            link={link}
            selection={selection}
            at={picked}
            paragraphIndex={paragraphIndex}
            onSelect={onSelect}
            onDone={() => setPicked(null)}
            run={run}
          />
        )}
      </div>
    );
  };

  // the live and next scenes, so an unplaced next scene still shows
  const label = (id: string | null) => {
    const scene = link.scenes.find((x) => x.id === id);
    if (!scene) return null;
    return (
      <>
        <strong>{scene.number || "–"}</strong> {scene.name}
        {!sceneCue.has(scene.id) && <span className="unplaced"> · not placed{scene.lineRef && `: ${scene.lineRef}`}</span>}
      </>
    );
  };

  return (
    <>
      {headings.length > 0 && (
        <nav className="outline">
          {headings.map((h) => (
            <button key={h.id} className={h.style} onClick={() => jump(h.id)}>
              {paragraphText(h)}
            </button>
          ))}
        </nav>
      )}
      <article className="script" ref={box} onWheel={() => setFollowing(false)} onTouchMove={() => setFollowing(false)}>
        {link.status === "connected" && (current || next) && (
          <div className="now-next">
            {current && <span className="live">LIVE {label(current)}</span>}
            <span className="next">{next ? <>NEXT {label(next)}</> : "End of cue list"}</span>
          </div>
        )}
        {!following && follow && (
          <button className="follow" onClick={() => setFollowing(true)}>
            Follow cues
          </button>
        )}
        {script.paragraphs.map(paragraph)}
      </article>
    </>
  );
}
