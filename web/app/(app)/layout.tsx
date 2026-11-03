import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell } from '../../components/shell/AppShell';
import { NoAccess } from '../../components/shell/NoAccess';
import { getSession } from '../../lib/server-api';
import { accessFor } from '../../lib/me';
import { NAV, SAAS_NAV, groupedNav, localizeNav, navFor } from '../../lib/nav';

export const dynamic = 'force-dynamic'; // the menu depends on who is looking

const READ_ONLY_NOTICE = 'الاشتراك منتهي: تقدر تشوف بيانات الشركة بس. جدّد الاشتراك عشان الفريق يكمّل الشغل.';

/** The browser tab carries the company's own name (white-label). */
export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const name = session.kind === 'user' ? session.me.company?.name : undefined;
  return name ? { title: `${name} — لوحة التحكم` } : {};
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.kind === 'anonymous') redirect('/login');
  if (session.kind === 'must-change') redirect('/change-password');
  if (session.kind === 'error') return <NoAccess kind="error" />;

  const { me } = session;
  const access = accessFor(me);
  if (access !== 'dashboard') return <NoAccess kind={access} name={me.name} />;

  return (
    <AppShell
      groups={groupedNav(navFor(localizeNav([...NAV, ...SAAS_NAV], me.company), me.permissions))}
      userName={me.name}
      brandName={me.company?.name || undefined}
      logoUrl={me.company?.logo_url}
      banner={me.entitlement?.read_only ? READ_ONLY_NOTICE : undefined}
    >
      {children}
    </AppShell>
  );
}
