import { redirect } from 'next/navigation';
import { AppShell } from '../../components/shell/AppShell';
import { NoAccess } from '../../components/shell/NoAccess';
import { getMe } from '../../lib/api';
import { accessFor } from '../../lib/me';
import { NAV, groupedNav, navFor } from '../../lib/nav';

export const dynamic = 'force-dynamic'; // the menu depends on who is looking

const READ_ONLY_NOTICE = 'الاشتراك منتهي: تقدر تشوف بيانات الشركة بس. جدّد الاشتراك عشان الفريق يكمّل الشغل.';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getMe();
  if (session.kind === 'anonymous') redirect('/login');
  if (session.kind === 'must-change') redirect('/change-password');
  if (session.kind === 'error') return <NoAccess kind="error" />;

  const { me } = session;
  const access = accessFor(me);
  if (access !== 'dashboard') return <NoAccess kind={access} name={me.name} />;

  return (
    <AppShell
      groups={groupedNav(navFor(NAV, me.permissions))}
      userName={me.name}
      banner={me.entitlement?.read_only ? READ_ONLY_NOTICE : undefined}
    >
      {children}
    </AppShell>
  );
}
