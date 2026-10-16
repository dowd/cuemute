import { inputTarget, previewScene, targetKey, type Scene, type Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface Props {
  snapshot: Snapshot;
  preview: Scene | null;
  viewOnly: boolean;
  run: Run;
}

// The show's channels with their live state from the desk. A channel the
// previewed scene will change splits in two: the state now on the left, the
// state after GO on the right. A change that would do nothing shows a dashed
// border and "already", which usually means someone changed the desk by hand.
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
          const label = (muted: boolean) => (muted ? "MUTED" : "ON");
          const split = item?.effective && live !== undefined;
          const classes = ["tile", split ? "split" : state];
          if (split) classes.push(live ? "from-muted" : "from-open");
          if (item && !split) classes.push("no-effect");
          return (
            <button
              key={ch.number}
              className={classes.join(" ")}
              disabled={viewOnly || live === undefined}
              title={live === undefined ? "Not reported by the desk" : "Click to toggle on the desk"}
              onClick={() =>
                run(() => api("POST", `/channels/${ch.number}/mute`, { muted: !live }))
              }
            >
              <span className="ch-num">{ch.number}</span>
              <span className="ch-name">{ch.name}</span>
              {split && item ? (
                <span className="ch-state halves">
                  <span>{label(live!)}</span>
                  <span>{label(item.change.muted)}</span>
                </span>
              ) : (
                <span className="ch-state">
                  {state === "unknown" ? "?" : label(live!)}
                  {item && live !== undefined && <span className="already"> · already</span>}
                  {item && live === undefined && <span className="already"> → {label(item.change.muted)}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
