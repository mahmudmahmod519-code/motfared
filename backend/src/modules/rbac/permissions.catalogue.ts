/**
 * The permission catalogue and the default grants of the four system roles (D-05, D-06).
 * Derived from the legacy guards (docs/rebuild/03 §1): sales < team_lead < admin < super_admin(owner).
 *
 * The same keys are seeded into the `permissions` table by a migration (a test fails when the two
 * drift), so adding a permission means: add it here, add a migration, decide which roles get it.
 */
export interface PermissionDef {
  key: string;
  group: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'leads.work', group: 'leads', description: 'Work own leads: claim, record call outcomes, own bookings, follow-ups and reminders' },
  { key: 'leads.manage', group: 'leads', description: 'Add, edit and delete leads; reassign bookings; return leads to the pool; redistribute a rep\'s book' },
  { key: 'uploads.manage', group: 'leads', description: 'Import leads from Excel files and Google Sheets' },
  { key: 'doctors.manage', group: 'leads', description: 'Manage clinics and campaigns, and which reps are linked to which clinic' },
  { key: 'dashboard.view', group: 'reports', description: 'Open the management dashboard' },
  { key: 'reports.view', group: 'reports', description: 'View performance, history and operational reports' },
  { key: 'finance.view', group: 'finance', description: 'View finance figures' },
  { key: 'finance.manage', group: 'finance', description: 'Record and edit finance entries' },
  { key: 'accounts.view', group: 'accounts', description: 'See the accounts of the team' },
  { key: 'accounts.manage', group: 'accounts', description: 'Create and edit sales accounts and their clinic links' },
  { key: 'accounts.admin', group: 'accounts', description: 'Create admins and team leads, deactivate any account' },
  { key: 'accounts.unrestrict', group: 'accounts', description: 'Switch the "unrestricted" exemption on or off for an account' },
  { key: 'scope.all_teams', group: 'accounts', description: 'See and act on every team instead of only one\'s own' },
  { key: 'settings.manage', group: 'settings', description: 'Change company settings (claim window, weekly day off, labels)' },
  { key: 'templates.manage', group: 'settings', description: 'Manage message templates' },
  { key: 'services.manage', group: 'settings', description: 'Manage the service catalogue' },
  { key: 'roles.view', group: 'security', description: 'See roles and their permissions' },
  { key: 'roles.manage', group: 'security', description: 'Create custom roles and change what a role may do' },
  { key: 'data.backup', group: 'security', description: 'Download backups and export company data' },
  { key: 'billing.view', group: 'billing', description: 'See the subscription, invoices and payments' },
  { key: 'billing.manage', group: 'billing', description: 'Change plan, pay, cancel or renew the subscription' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export type SystemRoleKey = 'owner' | 'admin' | 'team_lead' | 'sales';

export interface SystemRoleDef {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: string[];
}

const SALES = ['leads.work'];
const TEAM_LEAD = [...SALES, 'dashboard.view', 'reports.view', 'leads.manage', 'accounts.view'];
const ADMIN = [
  ...TEAM_LEAD,
  'scope.all_teams',
  'uploads.manage',
  'doctors.manage',
  'accounts.manage',
  'templates.manage',
  'services.manage',
  'finance.view',
  'finance.manage',
  'settings.manage',
];

export const SYSTEM_ROLES: SystemRoleDef[] = [
  { key: 'sales', name: 'Sales', description: 'Works their own leads through the app; no dashboard access', permissions: SALES },
  { key: 'team_lead', name: 'Team lead', description: 'Dashboard and lead management, confined to their own team', permissions: TEAM_LEAD },
  { key: 'admin', name: 'Admin', description: 'Everything operational across all teams; cannot create admins, deactivate accounts, change roles or manage billing', permissions: ADMIN },
  { key: 'owner', name: 'Owner', description: 'The company owner (CEO): every permission, always', permissions: PERMISSION_KEYS },
];

export const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key as string);
export const OWNER_KEY = 'owner';

/** Role keys: lower-case words joined by underscores. */
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export const systemRole = (key: string) => SYSTEM_ROLES.find((r) => r.key === key);
