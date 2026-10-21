import { useCallback, useRef, useState } from "react";

export type Run = (action: () => Promise<unknown>) => void;

// Runs an action and shows its error for a few seconds, if it fails.
export function useRun(): { run: Run; error: string | null } {
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run: Run = useCallback((action) => {
    action().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setError(null), 4000);
    });
  }, []);

  return { run, error };
}
