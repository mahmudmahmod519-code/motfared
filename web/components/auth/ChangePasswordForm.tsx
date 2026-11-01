'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const MIN = 8;

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const currentPassword = String(f.get('current') ?? '');
    const newPassword = String(f.get('next') ?? '');
    if (!currentPassword) return setError('اكتب كلمة السر الحالية');
    if (newPassword.length < MIN) return setError(`كلمة السر الجديدة لازم تكون ${MIN} حروف أو أكتر`);
    if (newPassword !== String(f.get('again') ?? '')) return setError('كلمتين السر مش زي بعض');
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 401) return setError('كلمة السر الحالية غلط');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
        return setError(typeof msg === 'string' && /differ|phone|short|least/i.test(msg) ? 'اختار كلمة سر مختلفة عن القديمة، وماتكونش رقم تليفونك' : 'حصلت مشكلة، جرّب تاني');
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('مفيش اتصال بالسيرفر، جرّب تاني');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="pw-current">كلمة السر الحالية</label>
        <input id="pw-current" name="current" type="password" autoComplete="current-password" />
      </div>
      <div className="field">
        <label htmlFor="pw-next">كلمة السر الجديدة</label>
        <input id="pw-next" name="next" type="password" autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="pw-again">كلمة السر الجديدة تاني</label>
        <input id="pw-again" name="again" type="password" autoComplete="new-password" />
      </div>
      <button type="submit" className="primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
        {forced ? 'حفظ وكمّل' : 'حفظ'}
      </button>
      <p className="error" role="alert">{error}</p>
    </form>
  );
}
