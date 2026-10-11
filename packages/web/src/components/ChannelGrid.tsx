import { inputTarget, previewScene, targetKey, type Scene, type Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface Props {
  snapshot: Snapshot;
  preview: Scene | null;
  viewOnly: boolean;
  run: Run;
}

// The show's channels with their live state from the desk. The previewed
// scene's changes show as arrows; a change that would do nothing is dimmed,
// which usually means someone changed the desk by hand.
export function ChannelGrid({ snapshot, preview, viewOnly, run }: Props) {
  const { channels } = snapshot.show;
  const items = preview ? previewScene(preview, snapshot.live) : [];
  const byKey = new Map(items.map((i) => [targetKey(i.change.target), i]));

  if (channels.length === 0) {
    return <p className="empty">No channels yet. Add them in Edit mode, under Channels.</p>;
  }

  return (
    <div className="grid-wrap">
      <div className="grid-caption">
        {preview ? (
          <>
            Previewing <strong>{[preview.number, preview.name].filter(Boolean).join(" ")}</strong>
          </>
        ) : (
          "Live desk"
        )}
      </div>
      <div className="grid">
        {channels.map((ch) => {
          const key = targetKey(inputTarget(ch.number));
          const live = snapshot.live[key];
          const item = byKey.get(key);
          const state = live === undefined ? "unknown" : live ? "muted" : "open";
          return (
            <button
              key={ch.number}
              className={`tile ${state} ${item ? (item.effective ? "changes" : "no-effect") : ""}`}
              disabled={viewOnly || live === undefined}
              title={live === undefined ? "Not reported by the desk" : "Click to toggle on the desk"}
              onClick={() =>
                run(() => api("POST", `/channels/${ch.number}/mute`, { muted: !live }))
              }
            >
              <span className="ch-num">{ch.number}</span>
              <span className="ch-name">{ch.name}</span>
              <span className="ch-state">
                {state === "unknown" ? "?" : state === "muted" ? "MUTED" : "ON"}
                {item && <span className="arrow"> → {item.change.muted ? "MUTE" : "ON"}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
