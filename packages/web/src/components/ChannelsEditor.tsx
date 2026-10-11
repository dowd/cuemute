import { useEffect, useState } from "react";
import type { Channel, Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

// The channels the show manages. Edited as a draft and saved together, so a
// half-typed list never reaches the scenes.
export function ChannelsEditor({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const saved = snapshot.show.channels;
  const [draft, setDraft] = useState<Channel[]>(saved);
  // the saved list the draft was taken from
  const [base, setBase] = useState<Channel[]>(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // follow changes saved elsewhere (another screen, a name import) unless the
  // draft has unsaved edits
  useEffect(() => {
    if (JSON.stringify(draft) === JSON.stringify(base)) setDraft(saved);
    setBase(saved);
  }, [JSON.stringify(saved)]);

  const update = (i: number, ch: Channel) => setDraft(draft.map((c, j) => (j === i ? ch : c)));
  const add = () => {
    const used = new Set(draft.map((c) => c.number));
    let n = 1;
    while (used.has(n)) n++;
    setDraft([...draft, { number: n, name: "" }]);
  };

  return (
    <div className="channels-editor">
      <p className="hint">
        Only these channels appear in scenes and in Record. Leave band and effects channels out.
      </p>
      <table>
        <tbody>
          {draft.map((ch, i) => (
            <tr key={i}>
              <td>
                <input
                  type="number"
                  min={1}
                  className="num-input"
                  value={ch.number}
                  onChange={(e) => update(i, { ...ch, number: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  value={ch.name}
                  placeholder="Name"
                  onChange={(e) => update(i, { ...ch, name: e.target.value })}
                />
              </td>
              <td>
                <button className="danger" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar">
        <button onClick={add}>Add channel</button>
        <button
          disabled={!dirty}
          onClick={() => {
            // the server keeps channels sorted and unique; match it so the
            // saved draft isn't left looking unsaved
            const next = [...new Map(draft.map((c) => [c.number, c])).values()].sort(
              (a, b) => a.number - b.number,
            );
            setDraft(next);
            run(() => api("PUT", "/channels", next));
          }}
        >
          Save
        </button>
        <button disabled={!dirty} onClick={() => setDraft(saved)}>
          Revert
        </button>
        {snapshot.connection.type === "qu" && (
          <button
            disabled={dirty}
            title="Copy names from the desk into these channels"
            onClick={() => run(() => api("POST", "/channels/import-names"))}
          >
            Import names from desk
          </button>
        )}
      </div>
    </div>
  );
}
