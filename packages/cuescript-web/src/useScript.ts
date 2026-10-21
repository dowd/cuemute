import { useEffect, useState } from "react";
import type { Script, ScriptInfo } from "@cuemute/script";
import { api } from "./api.ts";

// A production's script. Updates only say which script is in, so the text is
// fetched again only when a different one is imported.
export function useScript(productionId: string, info: ScriptInfo | null): Script | null {
  const [script, setScript] = useState<Script | null>(null);
  const key = info?.imported ?? null;

  useEffect(() => {
    if (key === null) {
      setScript(null);
      return;
    }
    let stale = false;
    api<{ script: Script | null }>("GET", `/productions/${encodeURIComponent(productionId)}/script`)
      .then((r) => !stale && setScript(r.script))
      .catch(() => !stale && setScript(null));
    return () => {
      stale = true;
    };
  }, [productionId, key]);

  return script;
}
