import { describe, expect, it } from "vitest";
import {
  back,
  createShow,
  deleteScene,
  duplicateNumbers,
  go,
  initialCursor,
  inputTarget,
  insertScene,
  jump,
  moveScene,
  newScene,
  orderForSending,
  parseShow,
  previewScene,
  recordChanges,
  setChannels,
  stateAtScene,
  targetKey,
  type Change,
  type Scene,
} from "./index.ts";

const mute = (n: number): Change => ({ target: inputTarget(n), muted: true });
const unmute = (n: number): Change => ({ target: inputTarget(n), muted: false });
const scene = (id: string, changes: Change[] = []): Scene => newScene({ number: id, changes }, id);

describe("orderForSending", () => {
  it("sends mutes before unmutes, keeping order within each", () => {
    const out = orderForSending([unmute(1), mute(2), unmute(3), mute(4)]);
    expect(out).toEqual([mute(2), mute(4), unmute(1), unmute(3)]);
  });
});

describe("previewScene", () => {
  it("marks changes that would do nothing against the live desk", () => {
    const s = scene("1", [unmute(1), mute(2), mute(3)]);
    const live = { [targetKey(inputTarget(1))]: true, [targetKey(inputTarget(2))]: true };
    const p = previewScene(s, live);
    expect(p.map((i) => i.effective)).toEqual([true, false, true]);
    expect(p[2]?.live).toBeUndefined(); // ch3 never reported
  });
});

describe("recordChanges", () => {
  const channels = [
    { number: 1, name: "Ana" },
    { number: 2, name: "Ben" },
    { number: 3, name: "Cal" },
  ];

  it("captures only channels that changed since the last GO", () => {
    const atGo = { "input:1": true, "input:2": true, "input:3": false };
    const live = { "input:1": false, "input:2": true, "input:3": true };
    expect(recordChanges(live, atGo, channels)).toEqual([unmute(1), mute(3)]);
  });

  it("ignores channels outside the show's list, such as the band", () => {
    const live = { "input:1": false, "input:20": false };
    const atGo = { "input:1": true, "input:20": true };
    expect(recordChanges(live, atGo, channels)).toEqual([unmute(1)]);
  });

  it("ignores channels the desk hasn't reported", () => {
    expect(recordChanges({}, { "input:1": true }, channels)).toEqual([]);
  });
});

describe("stateAtScene", () => {
  it("applies scenes in order up to the index", () => {
    const scenes = [scene("a", [unmute(1), unmute(2)]), scene("b", [mute(1)]), scene("c", [mute(2)])];
    expect(stateAtScene(scenes, 1)).toEqual({ "input:1": true, "input:2": false });
  });
});

describe("playback cursor", () => {
  const scenes = [scene("a"), scene("b"), scene("c")];

  it("GO fires scenes in order and stops at the end", () => {
    let c = initialCursor;
    const fired: string[] = [];
    for (let i = 0; i < 4; i++) {
      const step = go(scenes, c);
      c = step.cursor;
      if (step.fire) fired.push(step.fire.id);
    }
    expect(fired).toEqual(["a", "b", "c"]);
    expect(c).toEqual({ current: "c", next: null });
  });

  it("Back moves the next pointer only", () => {
    expect(back(scenes, { current: "b", next: "c" })).toEqual({ current: "b", next: "b" });
    expect(back(scenes, { current: "c", next: null })).toEqual({ current: "c", next: "c" });
    expect(back(scenes, { current: null, next: "a" })).toEqual({ current: null, next: "a" });
  });

  it("jump fires the scene and continues after it", () => {
    const step = jump(scenes, "b");
    expect(step.fire?.id).toBe("b");
    expect(step.cursor).toEqual({ current: "b", next: "c" });
  });

  it("survives the next scene being deleted", () => {
    const after = scenes.filter((s) => s.id !== "b");
    expect(go(after, { current: "a", next: "b" }).fire?.id).toBe("c");
  });

  it("picks up a scene appended after the end", () => {
    const more = [...scenes, scene("d")];
    expect(go(more, { current: "c", next: null }).fire?.id).toBe("d");
  });
});

describe("show editing", () => {
  const base = { ...createShow(), scenes: [scene("a"), scene("b")] };
  const ids = (s: { scenes: Scene[] }) => s.scenes.map((x) => x.id);

  it("inserts after a scene, at the top, or at the end if the anchor is gone", () => {
    expect(ids(insertScene(base, "a", scene("x")))).toEqual(["a", "x", "b"]);
    expect(ids(insertScene(base, null, scene("x")))).toEqual(["x", "a", "b"]);
    expect(ids(insertScene(base, "gone", scene("x")))).toEqual(["a", "b", "x"]);
  });

  it("moves and deletes scenes", () => {
    expect(ids(moveScene(base, "a", 1))).toEqual(["b", "a"]);
    expect(ids(deleteScene(base, "a"))).toEqual(["b"]);
  });

  it("keeps channels sorted and unique", () => {
    const s = setChannels(base, [
      { number: 3, name: "C" },
      { number: 1, name: "A" },
      { number: 3, name: "C2" },
    ]);
    expect(s.channels).toEqual([
      { number: 1, name: "A" },
      { number: 3, name: "C2" },
    ]);
  });

  it("finds duplicate scene numbers", () => {
    const scenes = [newScene({ number: "1" }), newScene({ number: " 1 " }), newScene({ number: "" })];
    expect([...duplicateNumbers(scenes)]).toEqual(["1"]);
  });

  it("round-trips through the file schema and rejects bad files", () => {
    const show = { ...base, channels: [{ number: 1, name: "Ana" }] };
    expect(parseShow(JSON.parse(JSON.stringify(show)))).toEqual(show);
    expect(() => parseShow({ ...show, schemaVersion: 2 })).toThrow();
  });
});
