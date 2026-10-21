import { useState } from "react";
import { showAll, type Filter } from "./cues.ts";

// Which departments this screen shows for a production. It is a per-screen
// choice, so it lives in this browser only: the LX operator's iPad can show
// only LX cues while the stage manager's laptop shows everything.
const key = (productionId: string) => `cuescript.filter.${productionId}`;

function load(productionId: string): Filter {
  try {
    const saved = JSON.parse(localStorage.getItem(key(productionId)) ?? "null") as Partial<Filter> | null;
    if (!saved) return showAll;
    return {
      hidden: Array.isArray(saved.hidden) ? saved.hidden.filter((x) => typeof x === "string") : [],
      notes: saved.notes !== false,
    };
  } catch {
    return showAll;
  }
}

export function useFilter(productionId: string): [Filter, (f: Filter) => void] {
  const [filter, setFilter] = useState(() => load(productionId));
  const set = (f: Filter) => {
    setFilter(f);
    try {
      localStorage.setItem(key(productionId), JSON.stringify(f));
    } catch {
      // private window or blocked storage: the choice lasts until reload
    }
  };
  return [filter, set];
}
