'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastKind = '' | 'good' | 'bad' | 'warning';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

/**
 * The original's toast stack (toast() in app.js): bottom of the page, newest last. A notice leaves after four
 * seconds; an error stays until its ✕ is pressed, because it usually needs acting on.
 */
export function useToasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const remove = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (message: string, kind: ToastKind = '') => {
      const id = ++seq.current;
      setItems((list) => [...list, { id, message, kind }]);
      if (kind !== 'bad') {
        const t = setTimeout(() => {
          timers.current.delete(t);
          remove(id);
        }, 4000);
        timers.current.add(t);
      }
    },
    [remove],
  );

  const toasts = (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`.trim()}>
          <div className="toast-text">{t.message}</div>
          <button type="button" aria-label="إغلاق" title="إغلاق" onClick={() => remove(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );

  return { toast, toasts };
}
