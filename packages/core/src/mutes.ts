import type { Change, Channel, MuteState, Scene, Target } from "./types.ts";

export function targetKey(t: Target): string {
  return `${t.kind}:${t.number}`;
}

export function inputTarget(number: number): Target {
  return { kind: "input", number };
}

// Mutes go out before unmutes, so two mics being swapped are never both open.
export function orderForSending(changes: readonly Change[]): Change[] {
  return [...changes.filter((c) => c.muted), ...changes.filter((c) => !c.muted)];
}

export interface PreviewItem {
  change: Change;
  live: boolean | undefined; // undefined: the desk hasn't reported this target
  effective: boolean; // false when the target is already in the scene's state
}

// What firing a scene would do against the desk as it is now. A change with no
// effect usually means someone changed the desk by hand.
export function previewScene(scene: Scene, live: MuteState): PreviewItem[] {
  return scene.changes.map((change) => {
    const current = live[targetKey(change.target)];
    return { change, live: current, effective: current !== change.muted };
  });
}

// The changes since the last GO, limited to the show's channels so band or
// effects channels never end up in a scene by accident.
export function recordChanges(
  live: MuteState,
  atLastGo: MuteState,
  channels: readonly Channel[],
): Change[] {
  const changes: Change[] = [];
  for (const ch of channels) {
    const target = inputTarget(ch.number);
    const key = targetKey(target);
    const now = live[key];
    if (now === undefined) continue;
    if (now !== atLastGo[key]) changes.push({ target, muted: now });
  }
  return changes;
}

// The state that applying scenes 0..index in order would leave, for the
// targets they mention. Not used by playback yet: it is what a tracking mode
// would send on a jump.
export function stateAtScene(scenes: readonly Scene[], index: number): MuteState {
  const state: MuteState = {};
  for (const scene of scenes.slice(0, index + 1)) {
    for (const c of scene.changes) state[targetKey(c.target)] = c.muted;
  }
  return state;
}
