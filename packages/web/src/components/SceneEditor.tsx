import { useState } from "react";
import { inputTarget, type Change, type Channel, type Scene, type ScenePatch } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

export const COLOURS = ["", "#d9534f", "#f0ad4e", "#e6d84a", "#5cb85c", "#4aa3df", "#9b6bd6", "#e377c2", "#888888"];

type TextField = "number" | "name" | "lineRef" | "notes";

interface Props {
  scene: Scene;
  channels: Channel[];
  run: Run;
}

// Text fields save when they lose focus; colour and changes save on click.
export function SceneEditor({ scene, channels, run }: Props) {
  const [draft, setDraft] = useState<Record<TextField, string>>({
    number: scene.number,
    name: scene.name,
    lineRef: scene.lineRef,
    notes: scene.notes,
  });

  const patch = (p: ScenePatch) => run(() => api("PATCH", `/scenes/${scene.id}`, p));
  const commit = (field: TextField) => {
    if (draft[field] !== scene[field]) patch({ [field]: draft[field] });
  };
  const text = (field: TextField, label: string, multiline = false) => {
    const props = {
      value: draft[field],
      onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [field]: e.target.value }),
      onBlur: () => commit(field),
    };
    return (
      <label>
        {label}
        {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
      </label>
    );
  };

  // each channel is untouched, muted or unmuted by this scene
  const changeFor = (n: number) => scene.changes.find((c) => c.target.number === n);
  const setChange = (n: number, muted: boolean | null) => {
    const others = scene.changes.filter((c) => c.target.number !== n);
    const changes: Change[] =
      muted === null ? others : [...others, { target: inputTarget(n), muted }];
    changes.sort((a, b) => a.target.number - b.target.number);
    patch({ changes });
  };

  return (
    <div className="scene-editor">
      <div className="row">
        {text("number", "Number")}
        {text("name", "Name")}
      </div>
      {text("lineRef", "Line / cue")}
      {text("notes", "Notes", true)}

      <div className="colours">
        {COLOURS.map((c) => (
          <button
            key={c || "none"}
            className={`swatch ${scene.colour === c ? "on" : ""}`}
            style={{ background: c || "transparent" }}
            title={c || "No colour"}
            onClick={() => patch({ colour: c })}
          />
        ))}
      </div>

      <h4>Changes</h4>
      {channels.length === 0 && <p className="empty">Add channels first.</p>}
      <table className="changes">
        <tbody>
          {channels.map((ch) => {
            const c = changeFor(ch.number);
            const value = c ? (c.muted ? "mute" : "on") : "none";
            return (
              <tr key={ch.number}>
                <td className="ch-num">{ch.number}</td>
                <td>{ch.name}</td>
                <td className="tri">
                  <button className={value === "none" ? "on" : ""} onClick={() => setChange(ch.number, null)}>
                    –
                  </button>
                  <button
                    className={value === "mute" ? "on mute" : ""}
                    onClick={() => setChange(ch.number, true)}
                  >
                    Mute
                  </button>
                  <button
                    className={value === "on" ? "on open" : ""}
                    onClick={() => setChange(ch.number, false)}
                  >
                    On
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
