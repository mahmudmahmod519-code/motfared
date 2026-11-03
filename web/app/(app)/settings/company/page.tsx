import '../../../../components/pages/settings.css';
import { CompanySettingsView } from '../../../../components/pages/CompanySettingsView';
import { EmptyState, NO_ACCESS } from '../../../../components/ui/EmptyState';
import { abilities, serverGet } from '../../../../lib/server-api';
import type { CompanyProfileDetails, IndustryTemplate } from '../../../../lib/types';

export const dynamic = 'force-dynamic';

const TITLE = 'إعدادات الشركة';

/** The company's name, logo, industry, words and optional features (GET/PATCH /api/company-profile). */
export default async function CompanySettingsPage() {
  const can = await abilities();
  if (!can) return null;
  if (!can.has('settings.manage')) return <EmptyState title={TITLE} message={NO_ACCESS} />;

  const [profile, industries] = await Promise.all([
    serverGet<CompanyProfileDetails>('/company-profile'),
    serverGet<IndustryTemplate[]>('/industries'),
  ]);
  if (!profile.ok) return <EmptyState title={TITLE} message={profile.message} />;
  if (!industries.ok) return <EmptyState title={TITLE} message={industries.message} />;

  return <CompanySettingsView initial={profile.data} industries={industries.data} canWrite={can.canWrite} />;
}
