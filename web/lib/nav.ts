/**
 * The sidebar: the original dashboard's pages, titles, groups and order (its NAV in app.js), with the
 * pages it restricted to admin roles now asking for a permission instead of a role name.
 * The original's "app release" page is not here: publishing the APK is a platform operation in a SaaS.
 * New SaaS pages (billing, settings, platform) are added when they are built, from the same tokens.
 */
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
