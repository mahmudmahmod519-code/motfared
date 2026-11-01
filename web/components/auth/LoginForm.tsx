'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { loginErrorMessage } from '../../lib/me';
import { safeNext } from '../../lib/redirect';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const phone = String(form.get('phone') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!phone || !password) return setError(loginErrorMessage({ status: 0, empty: true }));
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      if (!res.ok) return setError(loginErrorMessage({ status: res.status }));
      const body = await res.json().catch(() => ({}));
      router.replace(body?.must_change_password ? '/change-password' : safeNext(next));
      router.refresh();
    } catch {
      setError(loginErrorMessage({ status: 0 }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="login-phone">رقم التليفون</label>
        <input id="login-phone" name="phone" type="tel" autoComplete="username" inputMode="tel" dir="ltr" />
      </div>
      <div className="field">
        <label htmlFor="login-password">كلمة المرور</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" />
      </div>
      <button type="submit" className="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
        دخول
      </button>
      <p className="error" role="alert">{error}</p>
    </form>
  );
}
