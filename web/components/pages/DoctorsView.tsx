'use client';

import { Fragment, useState } from 'react';
import { ApiError, apiRequest } from '../../lib/http';
import { g, lil, withAl, withoutAl, type Terms } from '../../lib/terms';
import type { Campaign, Doctor, Team } from '../../lib/types';
import { useDialogs } from '../ui/useDialogs';
import { useToasts } from '../ui/useToasts';

const STOPPED_BADGE = { background: 'var(--surface-3)', color: 'var(--text-secondary)' };

/**
 * The original's doctors page (loadDoctorsView, addDoctor, editDoctorGroup, setDoctorActive in app.js) on the
 * rebuilt API. A clinic is stopped, never deleted: the API keeps its history. The original's onboarding,
 * messages, sheet and clinic-link buttons wait for their endpoints and are not shown.
 */
export function DoctorsView({
  terms: t,
  initial,
  teams,
  canManage,
  canMoveTeams,
}: {
  /** The company's words: its "doctor" level may be a branch, a project… */
  terms: Terms;
  initial: Doctor[];
  teams: Team[];
  canManage: boolean;
  /** Choosing a team needs scope.all_teams; a team lead's clinics always stay in their own team. */
  canMoveTeams: boolean;
}) {
  const [doctors, setDoctors] = useState(initial);
  const [openCampaigns, setOpenCampaigns] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const { toast, toasts } = useToasts();
  const { openDialog, confirmDialog, promptDialog, dialog } = useDialogs();

  // endings that agree with the company's word for the level (دكتور متوقف، عيادة متوقفة)
  const gu = (m: string, f: string) => g(t.unit, m, f);
  const teamOptions = teams.map((t) => ({ value: String(t.id), label: t.code }));
  const reload = async () => setDoctors(await apiRequest<Doctor[]>('/doctors'));

  async function attempt(run: () => Promise<void>) {
    try {
      await run();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'حصلت مشكلة، جرّب تاني', 'bad');
    }
  }

  async function addDoctor() {
    await openDialog({
      title: `${t.unit} ${gu('جديد', 'جديدة')}`,
      confirmLabel: 'إضافة',
      fields: [
        { name: 'name', label: `اسم ${withAl(t.unit)}`, required: true },
        ...(canMoveTeams && teamOptions.length ? [{ name: 'team', label: 'المجموعة', type: 'select' as const, options: teamOptions }] : []),
      ],
      submit: async (v) => {
        await apiRequest('/doctors', { method: 'POST', body: { name: v.name, ...(v.team && { team_id: Number(v.team) }) } });
        toast(`${gu('اتضاف', 'اتضافت')} ${v.name}`, 'good');
        await reload();
      },
    });
  }

  async function editTeam(d: Doctor) {
    const teamId = await promptDialog('تغيير المجموعة', {
      sub: `${d.name}\nالليدز بتوصل ل${withoutAl(t.reps)} المجموعة بس.`,
      label: 'المجموعة',
      options: teamOptions,
      value: d.team_id != null ? String(d.team_id) : '',
      confirmLabel: 'انقل',
    });
    if (teamId === null) return;
    if (String(d.team_id ?? '') === teamId) return toast(`${withAl(t.unit)} في المجموعة دي أصلاً`);
    const code = teams.find((t) => String(t.id) === teamId)?.code ?? teamId;
    await attempt(async () => {
      await apiRequest(`/doctors/${d.id}`, { method: 'PATCH', body: { team_id: Number(teamId) } });
      toast(`${d.name} ${gu('بقى', 'بقت')} في مجموعة ${code}`, 'good');
      await reload();
    });
  }

  async function setActive(d: Doctor, active: boolean) {
    const ok = await confirmDialog(active ? `تفعيل ${d.name} تاني` : `إيقاف ${d.name}`, {
      sub: active
        ? 'هيرجع يظهر في الفلاتر والرفع والربط، وليدزه اللي في المخزون تتسحب تاني.'
        : 'هيختفي من الفلاتر والرفع والربط، ومخزونه مش هيتسحب. ليدزه وحجوزاته وتاريخه بيفضلوا زي ما هما.',
      confirmLabel: active ? 'فعّل' : 'أوقف',
      danger: !active,
    });
    if (!ok) return;
    await attempt(async () => {
      await apiRequest(`/doctors/${d.id}`, { method: 'PATCH', body: { active } });
      toast(active ? `رجع ${d.name}` : `اتوقف ${d.name}`, 'good');
      if (!active && openCampaigns === d.id) setOpenCampaigns(null);
      await reload();
    });
  }

  async function toggleCampaigns(d: Doctor) {
    if (openCampaigns === d.id) return setOpenCampaigns(null);
    setOpenCampaigns(d.id);
    setCampaigns(null);
    await attempt(async () => setCampaigns(await apiRequest<Campaign[]>(`/doctors/${d.id}/campaigns`)));
  }

  async function addCampaign(d: Doctor) {
    const name = await promptDialog(`${t.campaign} ${g(t.campaign, 'جديد', 'جديدة')}`, { label: `اسم ${withAl(t.campaign)}`, confirmLabel: 'إضافة' });
    if (!name) return;
    await attempt(async () => {
      await apiRequest(`/doctors/${d.id}/campaigns`, { method: 'POST', body: { name } });
      toast(`${g(t.campaign, 'اتضاف', 'اتضافت')} ${t.campaign} ${name}`, 'good');
      setCampaigns(await apiRequest<Campaign[]>(`/doctors/${d.id}/campaigns`));
      await reload();
    });
  }

  async function renameCampaign(d: Doctor, c: Campaign) {
    const name = await promptDialog(`تعديل اسم ${withAl(t.campaign)}`, { label: 'الاسم', value: c.name });
    if (!name || name.trim() === c.name) return;
    await attempt(async () => {
      await apiRequest(`/campaigns/${c.id}`, { method: 'PATCH', body: { name: name.trim() } });
      toast(`اتعدّل اسم ${withAl(t.campaign)}`, 'good');
      setCampaigns(await apiRequest<Campaign[]>(`/doctors/${d.id}/campaigns`));
    });
  }

  return (
    <section>
      <div className="section-head">
        <h3>
          {t.units} و{t.campaigns}
        </h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage && (
            <button type="button" id="add-doctor-btn2" onClick={addDoctor}>
              + {t.unit} {gu('جديد', 'جديدة')} (الاسم بس)
            </button>
          )}
        </div>
      </div>
      <p className="hint">
        كل {t.unit} بينتمي لمجموعة، وبياخد ليدز من {withoutAl(t.reps)} المجموعة دي بس.
      </p>

      <div id="doctors-list">
        {doctors.length === 0 ? (
          <div className="empty">
            <strong>مفيش {withoutAl(t.units)} لسه</strong>ضيف أول {t.unit} عشان تقدر ترفع ليدزه.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="doctors-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>{withAl(t.unit)}</th>
                  <th>المجموعة</th>
                  <th>الشغل</th>
                  <th style={{ minWidth: 260 }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody id="doctors-tbody">
                {doctors.map((d) => {
                  const off = d.active === false;
                  const open = openCampaigns === d.id;
                  return (
                    <Fragment key={d.id}>
                      <tr className={off ? 'inactive-row' : undefined}>
                        <td>
                          <strong>{d.name}</strong>
                          {off && (
                            <>
                              {' '}
                              <span className="badge" style={STOPPED_BADGE}>
                                {gu('متوقف', 'متوقفة')}
                              </span>
                            </>
                          )}
                          <div className="sub">{d.city || '—'}</div>
                        </td>
                        <td>
                          <span>{d.team?.code ?? '—'}</span>{' '}
                          {canMoveTeams && !off && teamOptions.length > 0 && (
                            <button type="button" title="تغيير المجموعة" aria-label="تغيير المجموعة" onClick={() => editTeam(d)}>
                              ✎
                            </button>
                          )}
                        </td>
                        <td>
                          {d.campaigns_count ?? 0} {t.campaign}
                        </td>
                        <td>
                          <div className="actions">
                            {off ? (
                              canManage && (
                                <button type="button" onClick={() => setActive(d, true)}>
                                  فعّل تاني
                                </button>
                              )
                            ) : (
                              <>
                                <button type="button" aria-expanded={open} onClick={() => toggleCampaigns(d)}>
                                  {t.campaigns}
                                </button>
                                {canManage && (
                                  <button type="button" title={`${withAl(t.unit)} بطّل يشتغل معانا - يختفي من كل مكان ويفضل تاريخه`} onClick={() => setActive(d, false)}>
                                    أوقف
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={4}>
                            <CampaignList terms={t} doctor={d} campaigns={campaigns} canManage={canManage} onAdd={() => addCampaign(d)} onRename={(c) => renameCampaign(d, c)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {dialog}
      {toasts}
    </section>
  );
}

/** A doctor's campaigns, unfolded under the row the way the original unfolds a doctor's messages. */
function CampaignList({
  terms: t,
  doctor,
  campaigns,
  canManage,
  onAdd,
  onRename,
}: {
  terms: Terms;
  doctor: Doctor;
  campaigns: Campaign[] | null;
  canManage: boolean;
  onAdd: () => void;
  onRename: (c: Campaign) => void;
}) {
  return (
    <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }} aria-label={`${withoutAl(t.campaigns)} ${doctor.name}`}>
      {campaigns === null ? (
        <span className="sub">بيحمّل…</span>
      ) : campaigns.length === 0 ? (
        <span className="sub">
          مفيش {withoutAl(t.campaigns)} {lil(t.unit)} ده لسه.
        </span>
      ) : (
        campaigns.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{c.name}</span>
            {canManage && (
              <button type="button" onClick={() => onRename(c)}>
                تعديل الاسم
              </button>
            )}
          </div>
        ))
      )}
      {canManage && (
        <div>
          <button type="button" onClick={onAdd}>
            + {t.campaign} {g(t.campaign, 'جديد', 'جديدة')}
          </button>
        </div>
      )}
    </div>
  );
}
