import '../../../components/pages/pages.css';
import { AccountsView } from '../../../components/pages/AccountsView';
import { EmptyState, NO_ACCESS } from '../../../components/ui/EmptyState';
import { abilities, serverGet } from '../../../lib/server-api';
import type { Membership, Team } from '../../../lib/types';

export const dynamic = 'force-dynamic';

const TITLE = 'الحسابات والصلاحيات';

/** #/accounts in the original: the sales accounts, and (for whoever holds accounts.admin) every staff account. */
export default async function AccountsPage() {
  const can = await abilities();
  if (!can) return null;
  if (!can.has('accounts.manage')) return <EmptyState title={TITLE} message={NO_ACCESS} />;

  const [members, teams] = await Promise.all([serverGet<Membership[]>('/company-memberships'), serverGet<Team[]>('/teams')]);
  if (!members.ok) return <EmptyState title={TITLE} message={members.message} />;

  return (
    <AccountsView
      initial={members.data}
      teams={teams.ok ? teams.data : []}
      currentUserId={can.me.id}
      canAddSales={can.canWrite}
      canAdmin={can.has('accounts.admin')}
      canWrite={can.canWrite}
    />
  );
}
