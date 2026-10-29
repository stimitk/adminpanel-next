"use client";
import { useEffect, useState } from "react";
import { api, errorText } from "../../lib/api";

export interface LoadState<T> {
  data: T | null;
  loading: boolean;
  error: string;
}

/**
 * Reusable hook for fetching remote API data with abort control and reload revisions.
 */
export function useLoad<T>(path: string | null, revision = 0): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({
    data: null,
    loading: !!path,
    error: "",
  });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: "" });
      return;
    }

    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });

    api<T>(path, { signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ data: null, loading: false, error: errorText(error) });
        }
      });

    return () => controller.abort();
  }, [path, revision]);

  return state;
}
