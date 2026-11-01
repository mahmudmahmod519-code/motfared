import { redirect } from 'next/navigation';
import { LoginForm } from '../../../components/auth/LoginForm';
import { getMe } from '../../../lib/api';
import { safeNext } from '../../../lib/redirect';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  // Someone who is already signed in has no use for this page.
  const session = await getMe();
  if (session.kind === 'user') redirect(safeNext(searchParams.next));

  return (
    <div id="login-view">
      <div className="login-card">
        <h2>Lead to Doctor</h2>
        <p>لوحة تحكم المديرين</p>
        <LoginForm next={searchParams.next} />
      </div>
    </div>
  );
}
