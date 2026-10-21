import { z } from "zod";

// A script is the show's text as paragraphs of formatted runs. Each paragraph
// has an id that cues point at, unique within one version of the script.

export const runSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  // text colour as six hex digits, such as "c9211e"; absent for the default colour
  colour: z.string().regex(/^[0-9a-f]{6}$/).optional(),
  // a highlighter colour by Word's name for it, such as "yellow"
  highlight: z.string().optional(),
});

export const paragraphSchema = z.object({
  id: z.string().min(1),
  // a heading level, body text, a page number typed into the script, or a
  // row of a table, such as a cast list
  style: z.enum(["h1", "h2", "h3", "p", "page", "row"]),
  // a row's text is in cells, and its runs are empty
  runs: z.array(runSchema),
  cells: z.array(z.array(runSchema)).optional(),
});

export const scriptSchema = z.object({
  name: z.string(), // the file it came from
  imported: z.string(), // ISO time; also tells screens a new script is in
  paragraphs: z.array(paragraphSchema),
});

export type Run = z.infer<typeof runSchema>;
export type Paragraph = z.infer<typeof paragraphSchema>;
export type Script = z.infer<typeof scriptSchema>;

// what every screen is told about a script; the text itself is fetched once
export interface ScriptInfo {
  name: string;
  imported: string;
  paragraphs: number;
}

export const scriptInfo = (script: Script): ScriptInfo => ({
  name: script.name,
  imported: script.imported,
  paragraphs: script.paragraphs.length,
});

const runsText = (runs: Run[]) => runs.map((r) => r.text).join("");

// a paragraph's plain text; a row's cells are joined by " · "
export const paragraphText = (p: Paragraph): string =>
  p.cells ? p.cells.map(runsText).filter(Boolean).join(" · ") : runsText(p.runs);

// "FELIX. Bonjour…" is FELIX speaking. A name is capitals, then a full stop and a space.
const SPEAKER = /^([A-Z][A-Z0-9’'&/ -]{0,30}?)\.\s+(.*)$/s;

export function splitSpeaker(text: string): { speaker: string; rest: string } {
  const m = SPEAKER.exec(text);
  if (!m || !/[A-Z]{2}/.test(m[1]!)) return { speaker: "", rest: text };
  return { speaker: m[1]!, rest: m[2]! };
}

// letters and digits only, so curly and straight quotes, spaces and
// punctuation never stop a line matching
export const normalize = (text: string): string =>
  text.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "");
