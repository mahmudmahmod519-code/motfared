/**
 * The sidebar: the original dashboard's pages, titles, groups and order (its NAV in app.js), with the
 * pages it restricted to admin roles now asking for a permission instead of a role name.
 * The original's "app release" page is not here: publishing the APK is a platform operation in a SaaS.
 * New SaaS pages (billing, settings, platform) are added when they are built, from the same tokens.
 *
 * NAV keeps the original's (clinic) titles; localizeNav() puts a company's own words into them and drops the
 * clinic-only pages a company has switched off.
 */
import { withAl, type FeatureKey, type Terms } from './terms';

export interface NavItem {
  id: string;
  label: string;
  /** Group title shown before this item; null continues the previous group. */
  group: string | null;
  href: string;
  /** Permission the page needs; the API enforces it too, hiding is only courtesy. */
  permission?: string;
  /** Name of a live counter shown on the item (filled by the page that owns it). */
  badge?: string;
}

const item = (id: string, label: string, group: string | null, extra: Partial<NavItem> = {}): NavItem => ({
  id,
  label,
  group,
  href: id === 'overview' ? '/' : `/${id}`,
  ...extra,
});

export const NAV: NavItem[] = [
  item('overview', 'نظرة عامة', null),

  item('leads', 'العملاء', 'الشغل اليومي'),
  item('worksheet', 'متابعة العملاء', null),
  item('bookings', 'الحجوزات والتذكيرات', null),
  item('reminders', 'المتابعات', null),
  item('plan-start', 'الخطة العلاجية', null),
  item('overdue', 'المتابعات المتأخرة', null, { badge: 'overdue' }),
  item('calls', 'سجل المكالمات', null),

  item('reps', 'السيلز والأداء', 'الفريق'),
  item('distribution', 'التوزيع والربط', null),
  item('workload', 'حمل الشغل والتوزيع اليدوي', null),
  item('attendance', 'الحضور والغياب', null),

  item('upload', 'رفع الشيتات', 'البيانات', { permission: 'uploads.manage' }),
  item('doctors', 'الدكاترة والكامبينات', null, { permission: 'doctors.manage' }),
  item('doctor-report', 'تقرير الدكتور', null),

  item('finance', 'حسابات الموظفين', 'المالية', { permission: 'finance.view' }),

  item('services', 'الخدمات', 'الإعدادات'),
  item('templates', 'نصوص الرسائل', null),
  item('accounts', 'الحسابات والصلاحيات', null, { permission: 'accounts.manage' }),
];

/** Titles built from the company's words; with the clinic words each one is exactly the original title. */
const TITLES: Partial<Record<string, (t: Terms) => string>> = {
  leads: (t) => t.clients,
  worksheet: (t) => `متابعة ${t.clients}`,
  bookings: (t) => `${t.bookings} والتذكيرات`,
  'plan-start': (t) => t.plan,
  reps: (t) => `${t.reps} والأداء`,
  doctors: (t) => `${t.units} و${t.campaigns}`,
  'doctor-report': (t) => `تقرير ${withAl(t.unit)}`,
  services: (t) => t.services,
};

/** Pages that belong to an optional (clinic-only) feature. */
const FEATURE_OF: Partial<Record<string, FeatureKey>> = {
  'plan-start': 'plan_followup',
  'doctor-report': 'unit_report',
};

/** The menu in a company's own words, without the optional pages it has switched off. */
export function localizeNav(nav: NavItem[], company: { terms: Terms; features: Record<FeatureKey, boolean> } | null): NavItem[] {
  if (!company) return nav;
  return nav
    .filter((n) => {
      const f = FEATURE_OF[n.id];
      return !f || company.features[f];
    })
    .map((n) => {
      const title = TITLES[n.id];
      return title ? { ...n, label: title(company.terms) } : n;
    });
}

/** The pages a principal may see. Only the permission list counts, never a role name. */
export function navFor(nav: NavItem[], permissions: readonly string[] | undefined): NavItem[] {
  const held = new Set(permissions ?? []);
  return nav.filter((n) => !n.permission || held.has(n.permission));
}

/** The original rejects sales accounts at dashboard login: opening the dashboard needs dashboard.view. */
export function canEnterDashboard(permissions: readonly string[] | undefined): boolean {
  return !!permissions?.includes('dashboard.view');
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

/** Items in sections, a new section starting wherever the original printed a group title. */
export function groupedNav(items: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const n of items) {
    if (n.group !== null || groups.length === 0) groups.push({ title: n.group, items: [] });
    groups[groups.length - 1].items.push(n);
  }
  return groups;
}
