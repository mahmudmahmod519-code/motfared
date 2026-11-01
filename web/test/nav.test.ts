import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { legacyAppJs, read, requireLegacy } from './legacy';
import { NAV, canEnterDashboard, groupedNav, navFor } from '../lib/nav';
import { ICONS } from '../lib/icons';

/** The original's NAV array, read from its source: [{id, label, group, roles?, badge?}, …]. */
function legacyNav() {
  requireLegacy();
  const js = legacyAppJs();
  const block = js.slice(js.indexOf('const NAV = ['), js.indexOf('];', js.indexOf('const NAV = [')));
  return [...block.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", group: (null|"[^"]+")(?:, scoped: true)?(?:, roles: \[([^\]]*)\])?(?:, badge: "([^"]+)")?[^}]*\}/g)].map((m) => ({
    id: m[1],
    label: m[2],
    group: m[3] === 'null' ? null : m[3].slice(1, -1),
    roles: m[4] ? m[4].split(',').map((r) => r.trim().replace(/"/g, '')) : undefined,
    badge: m[5],
  }));
}

function legacyIcons() {
  const js = legacyAppJs();
  const block = js.slice(js.indexOf('const ICONS = {'), js.indexOf('\n};', js.indexOf('const ICONS = {')));
  return Object.fromEntries([...block.matchAll(/^\s*(?:"([^"]+)"|([a-z-]+)): '([^']*)',?$/gm)].map((m) => [m[1] ?? m[2], m[3]]));
}

describe('navigation', () => {
  it('has the original\'s pages, titles, groups and order (the app-release page moves to the platform area)', () => {
    const original = legacyNav().filter((n) => n.id !== 'app');
    expect(original.length).toBe(19);
    expect(NAV.map((n) => ({ id: n.id, label: n.label, group: n.group, badge: n.badge }))).toEqual(
      original.map((n) => ({ id: n.id, label: n.label, group: n.group, badge: n.badge })),
    );
  });

  it('shows the same group titles in the same order', () => {
    expect(groupedNav(NAV).map((g) => g.title)).toEqual([null, 'الشغل اليومي', 'الفريق', 'البيانات', 'المالية', 'الإعدادات']);
  });

  it('uses the original\'s icons, path for path', () => {
    const original = legacyIcons();
    for (const n of NAV) expect(ICONS[n.id], n.id).toBe(original[n.id]);
  });

  it('the pages the original restricted to admins now ask for a permission, not a role name', () => {
    const original = legacyNav().filter((n) => n.roles);
    expect(original.map((n) => n.id).sort()).toEqual(['accounts', 'app', 'doctors', 'finance', 'upload']);
    const needs = Object.fromEntries(NAV.filter((n) => n.permission).map((n) => [n.id, n.permission]));
    expect(needs).toEqual({ upload: 'uploads.manage', doctors: 'doctors.manage', finance: 'finance.view', accounts: 'accounts.manage' });
  });

  it('every permission a page asks for exists in the backend catalogue', () => {
    const catalogue = read(path.resolve(__dirname, '../../backend/src/modules/rbac/permissions.catalogue.ts'));
    for (const n of NAV) if (n.permission) expect(catalogue, n.permission).toContain(`key: '${n.permission}'`);
    expect(catalogue).toContain("key: 'dashboard.view'");
  });

  it('links: the overview is the root, every other page is /<id>', () => {
    for (const n of NAV) expect(n.href).toBe(n.id === 'overview' ? '/' : `/${n.id}`);
  });

  describe('what each default role sees', () => {
    const SALES = ['leads.work'];
    const TEAM_LEAD = [...SALES, 'dashboard.view', 'reports.view', 'leads.manage', 'accounts.view'];
    const ADMIN = [...TEAM_LEAD, 'scope.all_teams', 'uploads.manage', 'doctors.manage', 'accounts.manage', 'templates.manage', 'services.manage', 'finance.view', 'finance.manage', 'settings.manage'];
    const ids = (p: string[]) => navFor(NAV, p).map((n) => n.id);

    it('an admin sees every page', () => expect(ids(ADMIN)).toHaveLength(19));
    it('a team lead sees all but the four admin-only pages (as in the original)', () => {
      expect(ids(TEAM_LEAD)).toHaveLength(15);
      for (const hidden of ['upload', 'doctors', 'finance', 'accounts']) expect(ids(TEAM_LEAD)).not.toContain(hidden);
    });
    it('hiding follows the permission list only, never a role name', () => {
      expect(ids(['uploads.manage'])).toContain('upload');
      expect(navFor(NAV, [], ).some((n) => n.permission)).toBe(false);
    });
    it('only a role with dashboard.view may open the dashboard at all (the original rejects sales at login)', () => {
      expect(canEnterDashboard(SALES)).toBe(false);
      expect(canEnterDashboard(TEAM_LEAD)).toBe(true);
      expect(canEnterDashboard(undefined as any)).toBe(false);
    });
  });
});
