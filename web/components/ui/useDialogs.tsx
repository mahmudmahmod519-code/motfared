'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

export interface DialogField {
  name: string;
  label: string;
  type?: 'text' | 'tel' | 'email' | 'password' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  value?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
}

export type DialogValues = Record<string, string>;

export interface DialogOptions {
  title: string;
  sub?: string;
  fields?: DialogField[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** A caller-side check; a returned message is shown and the form stays open. */
  validate?: (values: DialogValues) => string | null;
  /**
   * Runs the change while the form is still open: a thrown error is shown under the fields and nothing typed is
   * lost. Without it the dialog just resolves to the values.
   */
  submit?: (values: DialogValues) => Promise<void>;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * The original's dialogs (openDialog / confirmDialog / promptDialog in app.js): a modal form that resolves to its
 * values, or null when the user backs out. A plain confirmation lands on Cancel, so an Enter pressed out of habit
 * backs out instead of confirming; a form lands on its first field. Escape and a click outside close it; Tab
 * stays inside; focus returns to where it was.
 */
export function useDialogs() {
  const [current, setCurrent] = useState<{ opts: DialogOptions; resolve: (v: DialogValues | null) => void; key: number } | null>(null);
  const seq = useRef(0);

  const openDialog = useCallback(
    (opts: DialogOptions) => new Promise<DialogValues | null>((resolve) => setCurrent({ opts, resolve, key: ++seq.current })),
    [],
  );

  const confirmDialog = useCallback(
    async (title: string, { sub, confirmLabel = 'تأكيد', danger = true }: { sub?: string; confirmLabel?: string; danger?: boolean } = {}) =>
      (await openDialog({ title, sub, confirmLabel, danger })) !== null,
    [openDialog],
  );

  const promptDialog = useCallback(
    async (
      title: string,
      { sub, label = '', value = '', type = 'text', options, confirmLabel = 'حفظ' }: { sub?: string; label?: string; value?: string; type?: DialogField['type']; options?: DialogField['options']; confirmLabel?: string } = {},
    ) => {
      const r = await openDialog({
        title,
        sub,
        confirmLabel,
        fields: [{ name: 'value', label: label || title, type: options ? 'select' : type, options, value, required: true }],
      });
      return r ? r.value : null;
    },
    [openDialog],
  );

  const dialog = current ? (
    <Dialog
      key={current.key}
      {...current.opts}
      onClose={(v) => {
        current.resolve(v);
        setCurrent(null);
      }}
    />
  ) : null;

  return { openDialog, confirmDialog, promptDialog, dialog };
}

function Dialog({ title, sub, fields = [], confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', danger = false, validate, submit, onClose }: DialogOptions & { onClose: (v: DialogValues | null) => void }) {
  const baseId = useId();
  const panel = useRef<HTMLFormElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea');
    (first ?? cancel.current)?.focus();
    return () => previous?.focus?.();
  }, []);

  const dismiss = () => !busy && onClose(null);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
    } else if (e.key === 'Tab' && panel.current) {
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const values: DialogValues = {};
    for (const field of fields) {
      const raw = String(data.get(field.name) ?? '');
      const value = field.type === 'password' ? raw : raw.trim();
      if (field.required && !value) {
        setError(`${field.label} مطلوب`);
        panel.current?.querySelector<HTMLElement>(`[name="${field.name}"]`)?.focus();
        return;
      }
      values[field.name] = value;
    }
    const problem = validate?.(values);
    if (problem) return setError(problem);
    if (!submit) return onClose(values);
    setBusy(true);
    setError('');
    try {
      await submit(values);
      onClose(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حصلت مشكلة، جرّب تاني');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && dismiss()} onKeyDown={onKeyDown}>
      <form ref={panel} className="modal" role="dialog" aria-modal="true" aria-labelledby={`${baseId}-t`} onSubmit={onSubmit} noValidate>
        <h2 id={`${baseId}-t`}>{title}</h2>
        {sub && <div className="sub">{sub}</div>}
        {fields.map((field, i) => {
          const id = `${baseId}-f${i}`;
          return (
            <div className="field" key={field.name}>
              <label htmlFor={id}>{field.label}</label>
              {field.type === 'select' ? (
                <select id={id} name={field.name} defaultValue={field.value}>
                  {(field.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea id={id} name={field.name} rows={3} defaultValue={field.value} placeholder={field.placeholder} />
              ) : (
                // The original's stylesheet styles text/tel/password inputs only; an email box is a text input with
                // the email keyboard, so it looks like every other field.
                <input id={id} name={field.name} type={field.type === 'email' ? 'text' : field.type ?? 'text'} inputMode={field.type === 'email' ? 'email' : undefined} autoCapitalize={field.type === 'email' ? 'off' : undefined} defaultValue={field.value} placeholder={field.placeholder} autoComplete={field.autoComplete} />
              )}
              {field.hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{field.hint}</div>}
            </div>
          );
        })}
        <p className="error" role="alert">
          {error}
        </p>
        <div className="modal-actions">
          <button type="submit" className={danger ? 'danger' : 'primary'} disabled={busy}>
            {confirmLabel}
          </button>
          <button type="button" ref={cancel} onClick={dismiss} disabled={busy}>
            {cancelLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
