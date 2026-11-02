import '../../../components/pages/pages.css';
import { ServicesView } from '../../../components/pages/ServicesView';
import { EmptyState } from '../../../components/ui/EmptyState';
import { abilities, serverGet } from '../../../lib/server-api';
import type { Service } from '../../../lib/types';

export const dynamic = 'force-dynamic';

/** الخدمات (#/services in the original): the company's treatments. Reads: any member; changes: services.manage. */
export default async function ServicesPage() {
  const can = await abilities();
  if (!can) return null;
  const services = await serverGet<Service[]>('/services');
  if (!services.ok) return <EmptyState title={can.terms.services} message={services.message} />;
  return <ServicesView terms={can.terms} initial={services.data} canManage={can.has('services.manage') && can.canWrite} />;
}
