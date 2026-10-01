import { useEffect, useState } from "react";

/** Loader identity is the request key; callers memoize it from their inputs. */
export function useNativeResource<T>(load: (() => Promise<T>) | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    load: typeof load;
    attempt: number;
    value?: T;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    if (!load) return;
    let active = true;
    void Promise.resolve()
      .then(load)
      .then(
        (value) => {
          if (active) setResult({ load, attempt, value, failed: false });
        },
        () => {
          if (active) setResult({ load, attempt, failed: true });
        },
      );
    return () => {
      active = false;
    };
  }, [load, attempt]);
  const match =
    result?.load === load && result?.attempt === attempt ? result : null;
  return {
    value: match?.value,
    status: !load
      ? ("IDLE" as const)
      : !match
        ? ("LOADING" as const)
        : match.failed
          ? ("FAILED" as const)
          : ("RESOLVED" as const),
    retry: () => setAttempt((value) => value + 1),
  };
}
