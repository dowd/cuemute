import type { CSSProperties, ReactNode } from "react";
import { splitSpeaker, type Paragraph, type Run } from "@cuemute/script";

// How script text draws, shared by the screen and the printed prompt book.

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

// Script colours are chosen for white paper, so on paper they stay as they
// are; on the dark screen, lightening them keeps dark ones readable.
function runStyle(r: Run, paper: boolean): CSSProperties | undefined {
  if (!r.colour && !r.highlight) return undefined;
  return {
    color: r.colour ? (paper ? `#${r.colour}` : `color-mix(in srgb, #${r.colour} 70%, white)`) : undefined,
    background: r.highlight ? (HIGHLIGHTS[r.highlight] ?? HIGHLIGHTS.yellow) : undefined,
  };
}

export function formatted(run: Run, node: ReactNode, key: number, paper = false): ReactNode {
  if (run.italic) node = <em>{node}</em>;
  if (run.bold) node = <strong>{node}</strong>;
  return (
    <span key={key} style={runStyle(run, paper)}>
      {node}
    </span>
  );
}

// A plain text import has no bold, so the speaker's name is bolded here.
export function displayRuns(p: Paragraph): Run[] {
  if (p.style !== "p" || p.runs.length !== 1 || p.runs[0]!.bold) return p.runs;
  const { speaker, rest } = splitSpeaker(p.runs[0]!.text);
  return speaker ? [{ text: `${speaker}. `, bold: true }, { ...p.runs[0]!, text: rest }] : p.runs;
}

// A paragraph's text with each word in its own span, numbered as the server
// numbers them. word(w, text, key, end) draws one word. A word split across two
// runs, such as a bold "paper." and a plain ")", keeps one number, and only its
// last part has end set, for a mark that belongs after the whole word.
export function paragraphWords(
  p: Paragraph,
  word: (w: number, text: string, key: number, end: boolean) => ReactNode,
  paper = false,
): ReactNode[] {
  const runs = displayRuns(p);
  const parts = runs.map((run) => run.text.split(/(\s+)/).filter(Boolean));
  const space = (t: string | undefined) => t === undefined || /^\s+$/.test(t);
  // the part after a given one, in the same run or the next
  const after = (ri: number, pi: number): string | undefined => {
    if (pi + 1 < parts[ri]!.length) return parts[ri]![pi + 1];
    for (let r = ri + 1; r < parts.length; r++) if (parts[r]!.length > 0) return parts[r]![0];
    return undefined;
  };
  let n = -1;
  let afterSpace = true;
  return runs.map((run, ri) =>
    formatted(
      run,
      parts[ri]!.map((part, pi) => {
        if (space(part)) {
          afterSpace = true;
          return part;
        }
        if (afterSpace) n++;
        afterSpace = false;
        return word(n, part, pi, space(after(ri, pi)));
      }),
      ri,
      paper,
    ),
  );
}
