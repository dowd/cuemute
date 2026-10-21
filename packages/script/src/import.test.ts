import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { normalize, paragraphText, splitSpeaker } from "./index.ts";
import { readScript, ScriptImportError } from "./import.ts";

// a zip holding one deflated file, as Word and Google Docs write them
function zip(name: string, content: string): Buffer {
  const data = deflateRawSync(Buffer.from(content));
  const file = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt16LE(file.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt16LE(file.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + file.length, 12);
  end.writeUInt32LE(local.length + file.length + data.length, 16);
  return Buffer.concat([local, file, data, central, file, end]);
}

const run = (text: string, rPr = "") => `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
const para = (runs: string, style = "") =>
  `<w:p w:rsidR="1"><w:pPr>${style && `<w:pStyle w:val="${style}"/>`}</w:pPr>${runs}</w:p>`;
const docx = (body: string) => zip("word/document.xml", `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`);

describe("readScript from Word", () => {
  it("keeps headings, page numbers and the formatting of each run", () => {
    const script = readScript(
      docx(
        para(run("SCENE 1."), "Heading2") +
          para(run("FELIX. ", '<w:b w:val="1"/><w:bCs w:val="1"/>') + run("(aside)", "<w:i/>") + run(" Bonjour &amp; welcome")) +
          "<w:p/>" +
          para(run("SONG (&#8220;HOUND DOG&#8221;)", '<w:color w:val="C9211E"/>')) +
          para(run("4"), "Heading3") +
          para(run("lit", '<w:highlight w:val="yellow"/><w:color w:val="000000"/>')),
      ),
      "show.docx",
    );
    expect(script.name).toBe("show.docx");
    expect(script.paragraphs.map(({ id: _, ...p }) => p)).toEqual([
      { style: "h2", runs: [{ text: "SCENE 1." }] },
      {
        style: "p",
        runs: [
          { text: "FELIX. ", bold: true },
          { text: "(aside)", italic: true },
          { text: " Bonjour & welcome" },
        ],
      },
      { style: "p", runs: [{ text: "SONG (“HOUND DOG”)", colour: "c9211e" }] },
      { style: "page", runs: [{ text: "4" }] },
      { style: "p", runs: [{ text: "lit", highlight: "yellow" }] },
    ]);
  });

  it("joins runs with the same format, and folds white space and tabs", () => {
    const script = readScript(
      docx(para(`${run("  Once ")}${run(" upon ")}<w:r><w:t>a</w:t><w:tab/><w:t>time  </w:t></w:r>`)),
      "x.docx",
    );
    expect(script.paragraphs[0]!.runs).toEqual([{ text: "Once upon a time" }]);
  });

  it("treats bold switched off as plain, and gives each paragraph its own id", () => {
    const script = readScript(docx(para(run("a", '<w:b w:val="0"/>')) + para(run("b"))), "x.docx");
    expect(script.paragraphs[0]!.runs).toEqual([{ text: "a" }]);
    expect(new Set(script.paragraphs.map((p) => p.id)).size).toBe(2);
  });

  it("refuses a zip that isn't a Word document, a damaged zip, and an empty file", () => {
    expect(() => readScript(zip("other.txt", "hi"), "x.docx")).toThrow(ScriptImportError);
    expect(() => readScript(Buffer.from("PK\x03\x04 broken", "latin1"), "x.docx")).toThrow("isn't a Word document");
    expect(() => readScript(docx("<w:p/>"), "x.docx")).toThrow("has no text");
  });
});

describe("readScript tables", () => {
  const cell = (...paras: string[]) => `<w:tc><w:tcPr/>${paras.join("")}</w:tc>`;
  const row = (...cells: string[]) => `<w:tr><w:trPr/>${cells.join("")}</w:tr>`;
  const tbl = (...rows: string[]) => `<w:tbl><w:tblPr/>${rows.join("")}</w:tbl>`;

  it("makes each row one paragraph of cells, in place among the paragraphs", () => {
    const script = readScript(
      docx(
        para(run("LIST OF CHARACTERS"), "Heading1") +
          tbl(
            row(cell(para(run("FELIX", "<w:b/>"))), cell(para(run("Annette")))),
            row(cell(para(run("CHORUS"))), cell(para(run("Youth")), para(run("and children")))),
            row(cell("<w:p/>"), cell("<w:p/>")),
          ) +
          para(run("ACT 1")),
      ),
      "x.docx",
    );
    expect(script.paragraphs.map(({ id: _, ...p }) => p)).toEqual([
      { style: "h1", runs: [{ text: "LIST OF CHARACTERS" }] },
      { style: "row", runs: [], cells: [[{ text: "FELIX", bold: true }], [{ text: "Annette" }]] },
      { style: "row", runs: [], cells: [[{ text: "CHORUS" }], [{ text: "Youth and children" }]] },
      { style: "p", runs: [{ text: "ACT 1" }] },
    ]);
    expect(paragraphText(script.paragraphs[1]!)).toBe("FELIX · Annette");
  });

  it("keeps the text of a one-column table as paragraphs", () => {
    const script = readScript(docx(tbl(row(cell(para(run("A note")), para(run("Two lines")))))), "x.docx");
    expect(script.paragraphs.map((p) => [p.style, paragraphText(p)])).toEqual([
      ["p", "A note"],
      ["p", "Two lines"],
    ]);
  });
});

describe("readScript from text", () => {
  it("makes each line a paragraph, with # headings and page numbers", () => {
    const script = readScript(Buffer.from("﻿# ACT 1\n\n## Scene 1\nFELIX.  Hello\r\n12\n"), "show.md");
    expect(script.paragraphs.map((p) => [p.style, paragraphText(p)])).toEqual([
      ["h1", "ACT 1"],
      ["h2", "Scene 1"],
      ["p", "FELIX. Hello"],
      ["page", "12"],
    ]);
  });
});

describe("text helpers", () => {
  it("find the character speaking", () => {
    expect(splitSpeaker("FELIX. Bonjour")).toEqual({ speaker: "FELIX", rest: "Bonjour" });
    expect(splitSpeaker("PAGE 2. Make way")).toEqual({ speaker: "PAGE 2", rest: "Make way" });
    expect(splitSpeaker("Once upon a time. Really.")).toEqual({ speaker: "", rest: "Once upon a time. Really." });
  });

  it("compare lines without quotes, case or punctuation", () => {
    expect(normalize("I will ‘ave to ‘ide!")).toBe(normalize("i will 'ave to 'ide"));
  });
});
