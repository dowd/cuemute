import { useState } from "react";
import { MUTES, type Cue, type LinkState, type Note, type ProductionView } from "@cuemute/script";
import { api } from "../api.ts";
import { cueLabel, nextNumber, type Filter, type Selection, type WordAt } from "../cues.ts";
import type { Run } from "../useRun.ts";

interface Props {
  production: ProductionView;
  link: LinkState;
  // what this screen shows: only those departments are offered, so a new cue never disappears
  filter: Filter;
  selection: Selection;
  at: WordAt;
  // each paragraph's position in the script, to number a new cue
  paragraphIndex: Map<string, number>;
  onSelect: (s: Selection) => void;
  onDone: () => void;
  run: Run;
}

type Form = { kind: "cue"; department: string; number: string; label: string } | { kind: "note"; text: string } | null;

// What can be done at a picked word: place or move the selected item here,
// add a cuemute scene, a department cue, or a note.
export function WordActions({ production: p, link, filter, selection, at, paragraphIndex, onSelect, onDone, run }: Props) {
  const [form, setForm] = useState<Form>(null);
  const path = `/productions/${encodeURIComponent(p.id)}`;
  const departments = p.departments.filter((d) => d.id !== MUTES && !filter.hidden.includes(d.id));
  const connected = link.status === "connected" && !filter.hidden.includes(MUTES);

  // the selected item, and what "place here" means for it
  let moveLabel = "";
  let move: (() => Promise<unknown>) | null = null;
  if (selection?.kind === "scene" && connected) {
    const scene = link.scenes.find((s) => s.id === selection.id);
    moveLabel = `Place ${scene?.number || "scene"} here`;
    move = () => api("PUT", `${path}/cues/scene/${encodeURIComponent(selection.id)}`, at);
  } else if (selection?.kind === "cue") {
    const cue = p.cues.find((c) => c.id === selection.id);
    if (cue && cue.kind === "cue") {
      moveLabel = `Move ${cueLabel(cue, p.departments)} here`;
      move = () => api("PATCH", `${path}/cues/${encodeURIComponent(cue.id)}`, { at });
    }
  } else if (selection?.kind === "note") {
    moveLabel = "Move the note here";
    move = () => api("PATCH", `${path}/notes/${encodeURIComponent(selection.id)}`, { at });
  }

  const order = (a: { paragraph: string; word: number }) => (paragraphIndex.get(a.paragraph) ?? 0) * 100_000 + a.word;

  const startCue = (department: string) => {
    const before = p.cues
      .filter((c): c is Extract<Cue, { kind: "cue" }> => c.kind === "cue" && c.department === department && c.at !== null)
      .filter((c) => order(c.at!) <= order(at))
      .sort((a, b) => order(a.at!) - order(b.at!))
      .map((c) => c.number);
    setForm({ kind: "cue", department, number: nextNumber(before), label: "" });
  };

  const save = () => {
    if (!form) return;
    run(async () => {
      if (form.kind === "cue") {
        const { department, number, label } = form;
        const { cue } = await api<{ cue: Cue }>("POST", `${path}/cues`, { department, number, label, at });
        onSelect({ kind: "cue", id: cue.id });
      } else {
        const { note } = await api<{ note: Note }>("POST", `${path}/notes`, { text: form.text, at });
        onSelect({ kind: "note", id: note.id });
      }
      onDone();
    });
  };

  if (form) {
    const dept = form.kind === "cue" ? p.departments.find((d) => d.id === form.department) : null;
    return (
      <form
        className="place cue-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {form.kind === "cue" ? (
          <>
            <span className="dept" style={{ color: dept?.colour }}>
              {dept?.code || dept?.name}
            </span>
            <input
              className="num-input"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              aria-label="Number"
              autoFocus
            />
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Label, such as Blackout"
              aria-label="Label"
            />
          </>
        ) : (
          <input
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Note"
            aria-label="Note"
            autoFocus
          />
        )}
        <button type="submit">Add</button>
        <button type="button" onClick={() => setForm(null)}>
          Back
        </button>
      </form>
    );
  }

  return (
    <div className="place">
      {move && (
        <button
          onClick={() =>
            run(async () => {
              await move!();
              onDone();
            })
          }
        >
          {moveLabel}
        </button>
      )}
      {connected && (
        <button
          onClick={() =>
            run(async () => {
              const { cue } = await api<{ cue: Cue }>("POST", `${path}/cues/new-scene`, at);
              if (cue.kind === "mute") onSelect({ kind: "scene", id: cue.scene });
              onDone();
            })
          }
          title="Add a scene to cuemute at this word"
        >
          New scene here
        </button>
      )}
      {departments.map((d) => (
        <button key={d.id} className="dept-button" style={{ borderLeftColor: d.colour }} onClick={() => startCue(d.id)}>
          + {d.code || d.name}
        </button>
      ))}
      {filter.notes && <button onClick={() => setForm({ kind: "note", text: "" })}>+ Note</button>}
      <button onClick={onDone}>Cancel</button>
    </div>
  );
}
