import '../../../components/pages/pages.css';
import { DoctorsView } from '../../../components/pages/DoctorsView';
import { EmptyState, NO_ACCESS } from '../../../components/ui/EmptyState';
import { abilities, serverGet } from '../../../lib/server-api';
import type { Doctor, Team } from '../../../lib/types';

export const dynamic = 'force-dynamic';


/** #/doctors in the original: clinics, their team and their campaigns, on /api/doctors and /api/teams. */
export default async function DoctorsPage() {
  const can = await abilities();
  if (!can) return null;
  const TITLE = `${can.terms.units} و${can.terms.campaigns}`;
  if (!can.has('doctors.manage')) return <EmptyState title={TITLE} message={NO_ACCESS} />;

  const [doctors, teams] = await Promise.all([serverGet<Doctor[]>('/doctors'), serverGet<Team[]>('/teams')]);
  if (!doctors.ok) return <EmptyState title={TITLE} message={doctors.message} />;

  return (
    <DoctorsView
      terms={can.terms}
      initial={doctors.data}
      teams={teams.ok ? teams.data : []}
      canManage={can.canWrite}
      canMoveTeams={can.has('scope.all_teams') && can.canWrite}
    />
  );
}
