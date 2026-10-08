import { useCallback, useRef, useState } from 'react';

/** Value with undo/redo. `set` with `coalesce` merges rapid edits (typing) into one undo step. */
export function useHistory<T>(initial: T) {
  const [present, setPresent] = useState(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastKey = useRef<string | null>(null);
  const lastAt = useRef(0);
  const [, force] = useState(0);

  const set = useCallback((next: T | ((prev: T) => T), coalesce?: string) => {
    setPresent((prev) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      if (value === prev) return prev;
      const now = Date.now();
      const merge = coalesce && coalesce === lastKey.current && now - lastAt.current < 1200;
      if (!merge) {
        past.current.push(prev);
        if (past.current.length > 80) past.current.shift();
      }
      future.current = [];
      lastKey.current = coalesce ?? null;
      lastAt.current = now;
      return value;
    });
    force((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    setPresent((prev) => {
      const p = past.current.pop();
      if (p === undefined) return prev;
      future.current.push(prev);
      lastKey.current = null;
      return p;
    });
    force((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    setPresent((prev) => {
      const f = future.current.pop();
      if (f === undefined) return prev;
      past.current.push(prev);
      lastKey.current = null;
      return f;
    });
    force((n) => n + 1);
  }, []);

  return { value: present, set, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
