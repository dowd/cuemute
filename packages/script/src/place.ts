import { normalize, paragraphText, splitSpeaker, type Paragraph } from "./format.ts";

// A place in the script: a paragraph by its position, and a word in it.
export interface Position {
  index: number;
  word: number;
}

// The words a cue can sit on, split at white space. Table rows hold no cues.
export const paragraphWords = (p: Paragraph): string[] =>
  p.style === "row" || p.style === "page" ? [] : paragraphText(p).split(/\s+/).filter(Boolean);

// a single number that orders positions through the script
export const order = (p: Position): number => p.index * 100_000 + p.word;

// how many words of a paragraph name the speaker, such as 1 for "FELIX. Hello"
function speakerWords(p: Paragraph): number {
  const { speaker } = splitSpeaker(paragraphText(p));
  return speaker ? speaker.split(/\s+/).length : 0;
}

// The words that end at a cue, as its quote: up to eight, from the same
// paragraph, leaving out the speaker's name. This is what finds the cue again
// in a new version of the script, and what cuemute shows as its Line / cue.
export function quoteAt(p: Paragraph, word: number, length = 8): string {
  const words = paragraphWords(p);
  const skip = speakerWords(p);
  const start = Math.max(word >= skip ? skip : 0, word - length + 1);
  return words.slice(start, word + 1).join(" ");
}

// Where a quote appears: the position of its last word, each time it ends on
// a whole word. It may start part-way through one, as a line copied from
// "I'd better go" might start "'d better go". Best first: paragraphs where the quote is the whole
// line (less the speaker and stage directions), then those that contain it.
export function findQuote(paragraphs: readonly Paragraph[], quote: string): Position[] {
  const key = normalize(quote);
  if (key.length < 2) return [];
  const whole: Position[] = [];
  const part: Position[] = [];
  paragraphs.forEach((p, index) => {
    const words = paragraphWords(p).map(normalize);
    const joined = words.join("");
    if (!joined.includes(key)) return;
    // where each word ends in the joined text
    const ends = new Map<number, number>();
    let at = 0;
    words.forEach((w, i) => {
      if (!w) return;
      at += w.length;
      ends.set(at, i);
    });
    const spoken = normalize(splitSpeaker(paragraphText(p)).rest.replace(/\([^)]*\)/g, ""));
    const isWhole = key === joined || key === spoken;
    for (let from = joined.indexOf(key); from >= 0; from = joined.indexOf(key, from + 1)) {
      const word = ends.get(from + key.length);
      if (word === undefined) continue;
      (isWhole ? whole : part).push({ index, word });
    }
  });
  return whole.length > 0 ? whole : part;
}

export interface Placeable {
  // where it is now, if it is placed; a placed item is fixed and bounds the rest
  at?: Position | null;
  // quotes to look for, best first, if it isn't placed
  quotes: string[];
  // where it was in an earlier version, to choose between matches
  near?: Position;
}

// Places items that run in order through the script, such as cuemute's scenes.
// An item with one possible place is fixed first. A quote that appears more
// than once is settled by order: it must fall between the items around it,
// and if more than one place is left, it goes nearest where it was. An item
// that still can't be placed for certain stays unplaced, never guessed.
export function placeInOrder(items: readonly Placeable[], paragraphs: readonly Paragraph[]): (Position | null)[] {
  const options = items.map((item) => {
    if (item.at) return [item.at];
    for (const q of item.quotes) {
      const found = q ? findQuote(paragraphs, q) : [];
      if (found.length > 0) return found;
    }
    return [];
  });
  const at: (Position | null)[] = options.map((o) => (o.length === 1 ? o[0]! : null));
  items.forEach((item, i) => {
    if (at[i] !== null || options[i]!.length === 0) return;
    const before = at.slice(0, i).filter((x) => x !== null).map(order);
    const after = at.slice(i + 1).filter((x) => x !== null).map(order);
    const lo = before.length > 0 ? Math.max(...before) : -1;
    const hi = after.length > 0 ? Math.min(...after) : Infinity;
    const between = options[i]!.filter((x) => order(x) >= lo && order(x) <= hi);
    if (between.length === 1) at[i] = between[0]!;
    else if (between.length > 1 && item.near) {
      const near = order(item.near);
      at[i] = between.reduce((a, b) => (Math.abs(order(b) - near) < Math.abs(order(a) - near) ? b : a));
    }
  });
  return at;
}

// Where a new item at a position goes in a list that runs in script order:
// after the last item placed before it. Null puts it first.
export function afterIdFor<T extends { id: string }>(
  items: readonly T[],
  placed: (item: T) => Position | null,
  at: Position,
): string | null {
  const firstAfter = items.findIndex((item) => {
    const p = placed(item);
    return p !== null && order(p) > order(at);
  });
  if (firstAfter < 0) return items.at(-1)?.id ?? null;
  return firstAfter === 0 ? null : items[firstAfter - 1]!.id;
}
