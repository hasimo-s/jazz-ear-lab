import { useCallback, useEffect, useState } from 'react';
import { getAllAttempts } from '../storage/db';
import type { AttemptRecord } from '../engine/stats';

export function useAttempts() {
  const [attempts, setAttempts] = useState<AttemptRecord[] | null>(null);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    getAllAttempts()
      .then((a) => { setAttempts(a); setError(false); })
      .catch(() => { setAttempts([]); setError(true); });
  }, []);
  useEffect(reload, [reload]);
  return { attempts, error, reload };
}
