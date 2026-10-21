import { inflateRawSync } from "node:zlib";
import type { Paragraph, Run, Script } from "./format.ts";

// The most a script's text may unpack to, so a hostile file can't fill memory.
const MAX_XML = 50 * 1024 * 1024;

// A file that can't be read as a script. The message is for the person importing it.
export class ScriptImportError extends Error {}

// Reads a script from a Word file (.docx, as Google Docs downloads it), or
// from plain text or Markdown, where each line is a paragraph and # marks a heading.
export function readScript(data: Buffer, name: string): Script {
  const ids = idMaker();
  let paragraphs: Paragraph[];
  if (data.subarray(0, 4).equals(Buffer.from("PK\x03\x04", "latin1"))) {
    const xml = unzipEntry(data, "word/document.xml");
    if (!xml) throw new ScriptImportError(`${name} isn't a Word document`);
    paragraphs = docxParagraphs(xml.toString("utf8"), ids);
  } else {
    paragraphs = textParagraphs(data.toString("utf8"), ids);
  }
  if (paragraphs.length === 0) throw new ScriptImportError(`${name} has no text`);
  return { name, imported: new Date().toISOString(), paragraphs };
}

// short random paragraph ids, unique within one script
function idMaker(): () => string {
  const used = new Set<string>();
  return () => {
    let id: string;
    do id = crypto.randomUUID().slice(0, 8);
    while (used.has(id));
    used.add(id);
    return id;
  };
}

// one file from a zip archive, or null if it isn't there
function unzipEntry(zip: Buffer, wanted: string): Buffer | null {
  try {
    // the central directory's end record sits in the last 64 KB
    let end = -1;
    for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
      if (zip.readUInt32LE(i) === 0x06054b50) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    const count = zip.readUInt16LE(end + 10);
    let p = zip.readUInt32LE(end + 16);
    for (let n = 0; n < count; n++) {
      if (zip.readUInt32LE(p) !== 0x02014b50) return null;
      const method = zip.readUInt16LE(p + 10);
      const size = zip.readUInt32LE(p + 20);
      const nameLength = zip.readUInt16LE(p + 28);
      const local = zip.readUInt32LE(p + 42);
      if (zip.toString("utf8", p + 46, p + 46 + nameLength) === wanted) {
        const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
        const body = zip.subarray(start, start + size);
        if (method === 0) return body;
        if (method === 8) return inflateRawSync(body, { maxOutputLength: MAX_XML });
        return null;
      }
      p += 46 + nameLength + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
    }
  } catch {
    // a damaged archive
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? all;
  });

const HEADINGS: Record<string, Paragraph["style"]> = { Title: "h1", Heading1: "h1", Heading2: "h2", Heading3: "h3" };

// A page number typed into the script, alone on its line. Google Docs scripts
// often carry these, and they help find a cue in the printed copy.
const PAGE = /^\d{1,4}$/;

// a toggle such as <w:b/> or <w:b w:val="1"/> is on; w:val="0" or "false" is off
function toggle(rPr: string, tag: "b" | "i"): boolean {
  const m = new RegExp(`<w:${tag}(?:\\s[^>]*?)?/>`).exec(rPr);
  if (!m) return false;
  const val = /w:val="([^"]*)"/.exec(m[0])?.[1];
  return val === undefined || !["0", "false", "off"].includes(val);
}

function runFormat(run: string): Omit<Run, "text"> {
  const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run)?.[1] ?? "";
  const format: Omit<Run, "text"> = {};
  if (toggle(rPr, "b")) format.bold = true;
  if (toggle(rPr, "i")) format.italic = true;
  const colour = /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(rPr)?.[1]?.toLowerCase();
  if (colour && colour !== "000000") format.colour = colour;
  const highlight = /<w:highlight w:val="(\w+)"/.exec(rPr)?.[1];
  if (highlight && highlight !== "none") format.highlight = highlight;
  return format;
}

const sameFormat = (a: Run, b: Omit<Run, "text">) =>
  a.bold === b.bold && a.italic === b.italic && a.colour === b.colour && a.highlight === b.highlight;

// Joins neighbouring runs with the same format, folds runs of white space into
// one space, and trims the paragraph's ends.
function tidy(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const last = out.at(-1);
    if (last && sameFormat(last, r)) last.text += r.text;
    else out.push({ ...r });
  }
  for (const r of out) r.text = r.text.replace(/\s+/g, " ");
  if (out[0]) out[0].text = out[0].text.trimStart();
  if (out.at(-1)) out.at(-1)!.text = out.at(-1)!.text.trimEnd();
  for (let i = 1; i < out.length; i++) {
    // a space at the end of one run makes a space at the start of the next redundant
    if (out[i - 1]!.text.endsWith(" ")) out[i]!.text = out[i]!.text.trimStart();
  }
  return out.filter((r) => r.text);
}

function docxParagraphs(xml: string, id: () => string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const [, body = ""] of xml.matchAll(/<w:p(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const runs: Run[] = [];
    for (const [run] of body.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)) {
      let text = "";
      for (const [, t] of run.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(?:tab|br|cr)\b[^>]*\/>/g)) {
        text += t === undefined ? " " : decode(t);
      }
      if (text) runs.push({ text, ...runFormat(run) });
    }
    const tidied = tidy(runs);
    if (tidied.length === 0) continue;
    const text = tidied.map((r) => r.text).join("");
    const styleId = /<w:pStyle w:val="([^"]+)"/.exec(body)?.[1] ?? "";
    out.push({ id: id(), style: PAGE.test(text) ? "page" : (HEADINGS[styleId] ?? "p"), runs: tidied });
  }
  return out;
}

function textParagraphs(text: string, id: () => string): Paragraph[] {
  const out: Paragraph[] = [];
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      out.push({ id: id(), style: `h${heading[1]!.length}` as Paragraph["style"], runs: [{ text: heading[2]! }] });
    } else {
      out.push({ id: id(), style: PAGE.test(line) ? "page" : "p", runs: [{ text: line }] });
    }
  }
  return out;
}
