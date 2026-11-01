import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '../../components/auth/ChangePasswordForm';
import { getMe } from '../../lib/api';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const session = await getMe();
  if (session.kind === 'anonymous' || session.kind === 'error') redirect('/login');
  const forced = session.kind === 'must-change';

  return (
    <div id="login-view">
      <div className="login-card">
        <h2>غيّر كلمة السر</h2>
        <p>{forced ? 'لازم تختار كلمة سر جديدة قبل ما تكمّل.' : 'اختار كلمة سر جديدة. هتتسجل خروج من باقي الأجهزة.'}</p>
        <ChangePasswordForm forced={forced} />
      </div>
    </div>
  );
}
