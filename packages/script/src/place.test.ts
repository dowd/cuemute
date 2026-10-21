import { describe, expect, it } from "vitest";
import { afterIdFor, findQuote, paragraphWords, placeInOrder, quoteAt, type Paragraph } from "./index.ts";

let n = 0;
const p = (text: string, style: Paragraph["style"] = "p"): Paragraph => ({ id: `p${n++}`, style, runs: [{ text }] });

const script = [
  p("SCENE 1.", "h2"), // 0
  p("JACQUES. (calling off) Felix!"), // 1
  p("FELIX. I will ‘ave to ‘ide! (He sits on the bench.)"), // 2
  p("JACQUES. Felix!"), // 3
  p("4", "page"), // 4
  p("JACQUES. Felix!"), // 5
  p("CAPUCINE. Hello."), // 6
];

describe("words and quotes", () => {
  it("count words across runs as the text reads", () => {
    const split: Paragraph = { id: "x", style: "p", runs: [{ text: "FELIX. ", bold: true }, { text: "‘ide" }, { text: "! Now" }] };
    expect(paragraphWords(split)).toEqual(["FELIX.", "‘ide!", "Now"]);
    expect(paragraphWords(p("12", "page"))).toEqual([]);
  });

  it("quote up to eight words ending at a word, without the speaker", () => {
    expect(quoteAt(script[2]!, 5)).toBe("I will ‘ave to ‘ide!");
    expect(quoteAt(script[2]!, 0)).toBe("FELIX.");
    expect(quoteAt(p("MA. one two three four five six seven eight nine ten"), 10)).toBe(
      "three four five six seven eight nine ten",
    );
  });
});

describe("findQuote", () => {
  it("finds the last word of a quote, ignoring quotes and punctuation", () => {
    expect(findQuote(script, "I will 'ave to 'ide")).toEqual([{ index: 2, word: 5 }]);
  });

  it("ends on a whole word, but may start part-way through one", () => {
    expect(findQuote(script, "Hell")).toEqual([]);
    expect(findQuote(script, "ill 'ave")).toEqual([{ index: 2, word: 3 }]);
  });

  it("prefers lines that are the whole quote, less the speaker and stage directions", () => {
    const lines = [p("JACQUES. Felix, come here!"), p("JACQUES. (off) Felix!"), p("MA. Felix!")];
    expect(findQuote(lines, "Felix!")).toEqual([
      { index: 1, word: 2 },
      { index: 2, word: 1 },
    ]);
    expect(findQuote(lines, "come here")).toEqual([{ index: 0, word: 3 }]);
  });
});

describe("placeInOrder", () => {
  it("settles a repeated quote by the items around it, and never guesses", () => {
    const items = [{ quotes: ["ave to ide"] }, { quotes: ["Felix!"] }, { quotes: ["Hello"] }];
    expect(placeInOrder(items, script)).toEqual([{ index: 2, word: 5 }, null, { index: 6, word: 1 }]);
    const tight = [{ quotes: ["ave to ide"] }, { quotes: ["Felix!"] }, { at: { index: 4, word: 0 }, quotes: [] }];
    expect(placeInOrder(tight, script)[1]).toEqual({ index: 3, word: 1 });
  });

  it("goes nearest where an item was, when order leaves more than one place", () => {
    expect(placeInOrder([{ quotes: ["Felix!"], near: { index: 5, word: 0 } }], script)).toEqual([{ index: 5, word: 1 }]);
  });

  it("tries each quote in turn, and leaves an item with none unplaced", () => {
    expect(placeInOrder([{ quotes: ["not here", "Hello"] }, { quotes: ["After song"] }], script)).toEqual([
      { index: 6, word: 1 },
      null,
    ]);
  });
});

describe("afterIdFor", () => {
  it("keeps a list in script order", () => {
    const items = [
      { id: "a", at: { index: 2, word: 0 } },
      { id: "x", at: null },
      { id: "b", at: { index: 6, word: 0 } },
    ];
    const at = (i: (typeof items)[number]) => i.at;
    expect(afterIdFor(items, at, { index: 4, word: 0 })).toBe("x");
    expect(afterIdFor(items, at, { index: 2, word: 3 })).toBe("x");
    expect(afterIdFor(items, at, { index: 7, word: 0 })).toBe("b");
    expect(afterIdFor(items, at, { index: 1, word: 0 })).toBeNull();
    expect(afterIdFor([], at, { index: 1, word: 0 })).toBeNull();
  });
});
