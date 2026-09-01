import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Minimal data-loading hook: runs `fn`, exposes {data, loading, error, reload},
 * and re-runs whenever the screen regains focus so approvals/punches made
 * elsewhere show up without a manual pull-to-refresh.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const result = await run();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong loading this screen.');
    } finally {
      setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, loading, error, reload };
}
