import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  paragraphText,
  splitSpeaker,
  type Cue,
  type LinkState,
  type Paragraph,
  type Run,
  type Script,
} from "@cuemute/script";

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

export interface WordAt {
  paragraph: string;
  word: number;
}

interface Props {
  script: Script;
  cues: Cue[];
  link: LinkState;
  // the Cues panel is open on this screen, so words can be picked
  editing: boolean;
  selected: string | null; // a cuemute scene id
  onSelect: (scene: string | null) => void;
  onPlace: (at: WordAt) => void;
  onNewScene: (at: WordAt) => void;
}

// The script as it reads in the source, with each mute cue marked on its word
// and in the margin. While cuemute is linked, it keeps the next scene's cue in
// view until the reader scrolls by hand. With the Cues panel open, selecting a
// word offers to place the selected scene there, or add a scene.
export function ScriptReader({ script, cues, link, editing, selected, onSelect, onPlace, onNewScene }: Props) {
  const box = useRef<HTMLElement>(null);
  const [following, setFollowing] = useState(true);
  const [picked, setPicked] = useState<WordAt | null>(null);
  const headings = script.paragraphs.filter((p) => p.style === "h1" || p.style === "h2");
  const current = link.status === "connected" ? link.current : null;
  const next = link.status === "connected" ? link.next : null;

  const byParagraph = new Map<string, Cue[]>();
  for (const c of cues) byParagraph.set(c.at.paragraph, [...(byParagraph.get(c.at.paragraph) ?? []), c]);
  const cueOf = new Map(cues.map((c) => [c.scene, c]));

  // the next scene's cue, or the nearest placed scene before it in cuemute's order
  let follow: Cue | undefined;
  if (link.status === "connected") {
    for (let i = link.scenes.findIndex((s) => s.id === (next ?? current)); i >= 0 && !follow; i--) {
      follow = cueOf.get(link.scenes[i]!.id);
    }
  }
  // while editing, the selected scene's cue
  const target = (editing && selected ? cueOf.get(selected) : undefined) ?? follow;

  useEffect(() => {
    const el = target && box.current?.querySelector<HTMLElement>(`[data-id="${target.at.paragraph}"]`);
    if (!following || !el || !box.current) return;
    box.current.scrollTo({ top: el.offsetTop - box.current.clientHeight / 3, behavior: "smooth" });
  }, [target?.at.paragraph, following, script]);

  useEffect(() => setPicked(null), [editing, script]);

  const jump = (id: string) => {
    setFollowing(false);
    const el = box.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    if (el && box.current) box.current.scrollTo({ top: el.offsetTop - 12, behavior: "smooth" });
  };

  const cueClass = (c: Cue) =>
    [c.scene === next && "next", c.scene === current && "current", c.scene === selected && "selected"]
      .filter(Boolean)
      .join(" ");

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
        const isPicked = picked?.paragraph === p.id && picked.word === w;
        const classes = ["w", here && "cued", here && cueClass(here[0]!), isPicked && "picked"];
        return (
          <span
            key={pi}
            className={classes.filter(Boolean).join(" ")}
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
    const here = byParagraph.get(p.id) ?? [];
    const marks = new Map<number, Cue[]>();
    for (const c of here) marks.set(c.at.word, [...(marks.get(c.at.word) ?? []), c]);
    const classes = [
      "para",
      p.style,
      here.some((c) => c.scene === next) && "next",
      here.some((c) => c.scene === current) && "current",
      editing && "pickable",
    ];
    return (
      <div key={p.id} data-id={p.id} className={classes.filter(Boolean).join(" ")}>
        <div className="cues">
          {here.map((c) => (
            <button
              key={c.id}
              className={`cue ${cueClass(c)}`}
              title={[c.number, c.name].filter(Boolean).join(" ")}
              disabled={!editing}
              onClick={() => onSelect(c.scene === selected ? null : c.scene)}
            >
              {c.number || "–"}
            </button>
          ))}
        </div>
        <div className="text">{words(p, marks)}</div>
        {editing && picked?.paragraph === p.id && (
          <div className="place">
            {selected && (
              <button
                onClick={() => {
                  onPlace(picked);
                  setPicked(null);
                }}
              >
                Place {link.scenes.find((s) => s.id === selected)?.number || "the selected scene"} here
              </button>
            )}
            <button
              onClick={() => {
                onNewScene(picked);
                setPicked(null);
              }}
            >
              New scene here
            </button>
            <button onClick={() => setPicked(null)}>Cancel</button>
          </div>
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
        {!cueOf.has(scene.id) && <span className="unplaced"> · not placed{scene.lineRef && `: ${scene.lineRef}`}</span>}
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
