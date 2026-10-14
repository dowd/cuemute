import { targetKey } from "./mutes.ts";
import type { Channel, Scene, Show } from "./types.ts";

// The channels a printed sheet covers: the show's list, plus any channel a
// scene changes that has since left the list, so nothing a scene does is hidden.
export function sheetChannels(show: Show): Channel[] {
  const byNumber = new Map(show.channels.map((c) => [c.number, c]));
  for (const s of show.scenes) {
    for (const c of s.changes) {
      if (!byNumber.has(c.target.number)) byNumber.set(c.target.number, { number: c.target.number, name: "" });
    }
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export interface PlotCell {
  // the channel's state after this scene: true muted, false open, null if no
  // scene so far has set it (the show doesn't say how channels start)
  muted: boolean | null;
  // this scene changes the channel
  changed: boolean;
}

// One row per scene, one cell per channel, with state tracked from the top.
export function micPlot(scenes: readonly Scene[], channels: readonly Channel[]): PlotCell[][] {
  const state = new Map<string, boolean>();
  return scenes.map((scene) => {
    const changed = new Set<string>();
    for (const c of scene.changes) {
      const key = targetKey(c.target);
      state.set(key, c.muted);
      changed.add(key);
    }
    return channels.map((ch) => {
      const key = targetKey({ kind: "input", number: ch.number });
      return { muted: state.get(key) ?? null, changed: changed.has(key) };
    });
  });
}

// "Mute: Ana (1), Ben (2) · On: Cal (3)" for a cue list row; mutes first,
// the order they are sent in.
export function describeChanges(scene: Scene, channels: readonly Channel[]): string {
  const name = (n: number) => {
    const c = channels.find((x) => x.number === n);
    return c?.name ? `${c.name} (${n})` : `Ch ${n}`;
  };
  const list = (muted: boolean) =>
    scene.changes
      .filter((c) => c.muted === muted)
      .map((c) => c.target.number)
      .sort((a, b) => a - b)
      .map(name)
      .join(", ");
  const parts = [];
  const mutes = list(true);
  const opens = list(false);
  if (mutes) parts.push(`Mute: ${mutes}`);
  if (opens) parts.push(`On: ${opens}`);
  return parts.join(" · ");
}
