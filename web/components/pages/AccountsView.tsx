'use client';

import { useState } from 'react';
import { ApiError, apiRequest } from '../../lib/http';
import type { Membership, Team } from '../../lib/types';
import { useDialogs, type DialogValues } from '../ui/useDialogs';
import { useToasts } from '../ui/useToasts';

/** The original's labels; its super admin is the company owner here. A custom role shows its key. */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'سوبر أدمن',
  admin: 'أدمن',
  team_lead: 'رئيس فريق',
  sales: 'سيلز',
};
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

const MIN_PASSWORD = 8;
const STOPPED_BADGE = { background: 'var(--surface-3)', color: 'var(--text-secondary)' };
const UNRESTRICTED_BADGE = { background: 'var(--warning)', color: '#000' };

/** An account that can sign in: the user and their place in the company are both live. */
export const isActive = (m: Membership) => m.status === 'active' && (m.user?.status === 'active' || m.user?.status === 'pending');

const byName = (a: Membership, b: Membership) => (a.user?.name ?? '').localeCompare(b.user?.name ?? '', 'ar');

/**
 * The original's accounts page (loadAccounts, loadStaff, addRep, addUser, deleteUser, reactivateUser in app.js) on
 * /api/company-memberships and /api/users. The original's password reset, "بدون قيود" switch, team move, app
 * version and last-seen columns wait for their endpoints and are not shown.
 */
export function AccountsView({
  initial,
  teams,
  currentUserId,
  canAddSales,
  canAdmin,
  canWrite,
}: {
  initial: Membership[];
  teams: Team[];
  currentUserId: string;
  canAddSales: boolean;
  /** accounts.admin: the original's super-admin section (every account, other roles, deactivation). */
  canAdmin: boolean;
  canWrite: boolean;
}) {
  const [members, setMembers] = useState(initial);
  const { toast, toasts } = useToasts();
  const { openDialog, confirmDialog, dialog } = useDialogs();

  const teamCode = (id: number | null) => (id == null ? '—' : teams.find((t) => t.id === id)?.code ?? '—');
  const reload = async () => setMembers(await apiRequest<Membership[]>('/company-memberships'));

  const withUser = members.filter((m) => m.user).sort(byName);
  const reps = withUser.filter((m) => m.role === 'sales' && isActive(m));

  async function attempt(run: () => Promise<void>) {
    try {
      await run();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'حصلت مشكلة، جرّب تاني', 'bad');
    }
  }

  const passwordCheck = (v: DialogValues) => (v.password.length < MIN_PASSWORD ? `كلمة المرور لازم تكون ${MIN_PASSWORD} حروف أو أكتر` : null);

  /** Both forms create the account and its membership in one request (POST /api/users). */
  const create = (v: DialogValues, role: string) =>
    apiRequest('/users', { method: 'POST', body: { name: v.name, phone: v.phone, email: v.email, password: v.password, role } });

  async function addRep() {
    await openDialog({
      title: 'سيلز جديد',
      confirmLabel: 'إنشاء',
      fields: [
        { name: 'name', label: 'الاسم', required: true },
        { name: 'phone', label: 'رقم التليفون', type: 'tel', required: true, placeholder: '01xxxxxxxxx' },
        { name: 'email', label: 'الإيميل', type: 'email', required: true, autoComplete: 'off' },
        { name: 'password', label: 'كلمة المرور', type: 'password', required: true, autoComplete: 'new-password' },
      ],
      validate: passwordCheck,
      submit: async (v) => {
        await create(v, 'sales');
        toast(`اتضاف ${v.name}`, 'good');
        await reload();
      },
    });
  }

  async function addUser() {
    await openDialog({
      title: 'حساب جديد',
      confirmLabel: 'إنشاء',
      fields: [
        { name: 'name', label: 'اسم الموظف', required: true },
        {
          name: 'role',
          label: 'الصلاحية',
          type: 'select',
          value: 'sales',
          options: [
            { value: 'sales', label: 'سيلز' },
            { value: 'team_lead', label: 'رئيس فريق' },
            { value: 'admin', label: 'أدمن' },
          ],
        },
        { name: 'phone', label: 'رقم التليفون', type: 'tel', required: true, placeholder: '01xxxxxxxxx' },
        { name: 'email', label: 'الإيميل', type: 'email', required: true, autoComplete: 'off' },
        { name: 'password', label: 'كلمة المرور', type: 'password', required: true, autoComplete: 'new-password' },
      ],
      validate: passwordCheck,
      submit: async (v) => {
        await create(v, v.role);
        toast(`اتعمل حساب ${v.name} بصلاحية ${roleLabel(v.role)}`, 'good');
        await reload();
      },
    });
  }

  /** The original's "مسح": the account stops and cannot sign in, and stays listed so it can come back. */
  async function deactivate(m: Membership) {
    const name = m.user!.name;
    const ok = await confirmDialog(`حذف ${name} (${roleLabel(m.role)})`, {
      sub: 'الحساب بيتوقف ومبيقدرش يدخل، وبيفضل ظاهر هنا عشان تقدر تفعّله تاني لو لزم.',
      confirmLabel: 'امسح',
    });
    if (!ok) return;
    await attempt(async () => {
      await apiRequest(`/users/${m.user_id}/status`, { method: 'PATCH', body: { status: 'inactive' } });
      toast(`اتمسح ${name}.`, 'good');
      await reload();
    });
  }

  async function reactivate(m: Membership) {
    const name = m.user!.name;
    const ok = await confirmDialog(`تفعيل ${name} تاني`, {
      sub: 'الحساب هيرجع يقدر يدخل بنفس كلمة السر القديمة. غيّرها بعدها لو كانت اتوزعت.',
      confirmLabel: 'فعّل',
      danger: false,
    });
    if (!ok) return;
    await attempt(async () => {
      await apiRequest(`/users/${m.user_id}/status`, { method: 'PATCH', body: { status: 'active' } });
      toast(`اتفعّل ${name} تاني`, 'good');
      await reload();
    });
  }

  return (
    <>
      <section id="accounts-section">
        <h3>حسابات السيلز</h3>
        {canAddSales && (
          <div className="toolbar" style={{ marginBottom: 12 }}>
            <button type="button" className="primary" id="add-rep-btn" onClick={addRep}>
              + سيلز جديد
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table id="accounts-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>التليفون</th>
                <th>المجموعة</th>
              </tr>
            </thead>
            <tbody id="accounts-tbody">
              {reps.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-row">
                    مفيش حسابات سيلز لسه
                  </td>
                </tr>
              ) : (
                reps.map((m) => (
                  <tr key={m.id}>
                    <td>{m.user!.name}</td>
                    <td>{m.user!.phone ? <span dir="ltr">{m.user!.phone}</span> : '—'}</td>
                    <td>{teamCode(m.team_id)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canAdmin && (
        <section id="staff-section">
          <h3>إدارة الموظفين والصلاحيات</h3>
          {canWrite && (
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <button type="button" className="primary" id="add-user-btn" onClick={addUser}>
                + حساب جديد
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>سوبر أدمن بس هو اللي يقدر يضيف أو يمسح حسابات</span>
            </div>
          )}
          <div className="table-wrap">
            <table id="staff-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>التليفون</th>
                  <th>الصلاحية</th>
                  <th>المجموعة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="staff-tbody">
                {withUser.map((m) => {
                  const active = isActive(m);
                  return (
                    <tr key={m.id} className={active ? undefined : 'inactive-row'}>
                      <td>
                        {m.user!.name}
                        {!active && (
                          <>
                            {' '}
                            <span className="badge" style={STOPPED_BADGE}>
                              موقوف
                            </span>
                          </>
                        )}
                        {m.unrestricted && (
                          <>
                            {' '}
                            <span className="badge" style={UNRESTRICTED_BADGE} title="بيسحب ليدز في أي وقت ومن غير قيود الفريق">
                              بدون قيود
                            </span>
                          </>
                        )}
                      </td>
                      <td>{m.user!.phone ? <span dir="ltr">{m.user!.phone}</span> : '—'}</td>
                      <td>{roleLabel(m.role)}</td>
                      <td>{teamCode(m.team_id)}</td>
                      <td>
                        {canWrite &&
                          (!active ? (
                            <button type="button" onClick={() => reactivate(m)}>
                              تفعيل تاني
                            </button>
                          ) : (
                            m.user_id !== currentUserId && (
                              <button type="button" style={{ color: 'var(--critical)' }} onClick={() => deactivate(m)}>
                                مسح
                              </button>
                            )
                          ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {dialog}
      {toasts}
    </>
  );
}
