import { useEffect, useRef, useState } from "react";
import {
  paragraphText,
  type Cue,
  type LinkState,
  type MuteCue,
  type Note,
  type Paragraph,
  type ProductionView,
  type Script,
} from "@cuemute/script";
import { cueLabel, cueTitle, departmentOf, isSelected, type Selection, type WordAt } from "../cues.ts";
import { formatted, paragraphWords } from "../render.tsx";
import type { Run as RunAction } from "../useRun.ts";
import { WordActions } from "./WordActions.tsx";

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

  // each word in a span, marked if a cue sits on it, and pickable while editing
  const words = (p: Paragraph, marks: Map<number, Cue[]>) =>
    paragraphWords(p, (w, text, key) => {
      const first = marks.get(w)?.[0];
      const isPicked = picked?.paragraph === p.id && picked.word === w;
      const classes = ["w", first && "cued", first && cueClass(first), isPicked && "picked"];
      const colour = first?.kind === "cue" ? departmentOf(first, departments)?.colour : undefined;
      return (
        <span
          key={key}
          className={classes.filter(Boolean).join(" ")}
          style={colour ? { textDecorationColor: colour } : undefined}
          onClick={editing ? () => setPicked(isPicked ? null : { paragraph: p.id, word: w }) : undefined}
        >
          {text}
        </span>
      );
    });

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
