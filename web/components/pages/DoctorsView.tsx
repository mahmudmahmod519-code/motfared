'use client';

import { Fragment, useState } from 'react';
import { ApiError, apiRequest } from '../../lib/http';
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
  initial,
  teams,
  canManage,
  canMoveTeams,
}: {
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
      title: 'دكتور جديد',
      confirmLabel: 'إضافة',
      fields: [
        { name: 'name', label: 'اسم الدكتور', required: true },
        ...(canMoveTeams && teamOptions.length ? [{ name: 'team', label: 'المجموعة', type: 'select' as const, options: teamOptions }] : []),
      ],
      submit: async (v) => {
        await apiRequest('/doctors', { method: 'POST', body: { name: v.name, ...(v.team && { team_id: Number(v.team) }) } });
        toast(`اتضاف ${v.name}`, 'good');
        await reload();
      },
    });
  }

  async function editTeam(d: Doctor) {
    const teamId = await promptDialog('تغيير المجموعة', {
      sub: `${d.name}\nالليدز بتوصل لسيلز المجموعة بس.`,
      label: 'المجموعة',
      options: teamOptions,
      value: d.team_id != null ? String(d.team_id) : '',
      confirmLabel: 'انقل',
    });
    if (teamId === null) return;
    if (String(d.team_id ?? '') === teamId) return toast('الدكتور في المجموعة دي أصلاً');
    const code = teams.find((t) => String(t.id) === teamId)?.code ?? teamId;
    await attempt(async () => {
      await apiRequest(`/doctors/${d.id}`, { method: 'PATCH', body: { team_id: Number(teamId) } });
      toast(`${d.name} بقى في مجموعة ${code}`, 'good');
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
    const name = await promptDialog('كامبين جديد', { label: 'اسم الكامبين', confirmLabel: 'إضافة' });
    if (!name) return;
    await attempt(async () => {
      await apiRequest(`/doctors/${d.id}/campaigns`, { method: 'POST', body: { name } });
      toast(`اتضاف كامبين ${name}`, 'good');
      setCampaigns(await apiRequest<Campaign[]>(`/doctors/${d.id}/campaigns`));
      await reload();
    });
  }

  async function renameCampaign(d: Doctor, c: Campaign) {
    const name = await promptDialog('تعديل اسم الكامبين', { label: 'الاسم', value: c.name });
    if (!name || name.trim() === c.name) return;
    await attempt(async () => {
      await apiRequest(`/campaigns/${c.id}`, { method: 'PATCH', body: { name: name.trim() } });
      toast('اتعدّل اسم الكامبين', 'good');
      setCampaigns(await apiRequest<Campaign[]>(`/doctors/${d.id}/campaigns`));
    });
  }

  return (
    <section>
      <div className="section-head">
        <h3>الدكاترة والكامبينات</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canManage && (
            <button type="button" id="add-doctor-btn2" onClick={addDoctor}>
              + دكتور جديد (الاسم بس)
            </button>
          )}
        </div>
      </div>
      <p className="hint">كل دكتور بينتمي لمجموعة، وبياخد ليدز من سيلز المجموعة دي بس.</p>

      <div id="doctors-list">
        {doctors.length === 0 ? (
          <div className="empty">
            <strong>مفيش دكاترة لسه</strong>ضيف أول دكتور عشان تقدر ترفع ليدزه.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="doctors-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>الدكتور</th>
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
                                متوقف
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
                        <td>{d.campaigns_count ?? 0} كامبين</td>
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
                                  الكامبينات
                                </button>
                                {canManage && (
                                  <button type="button" title="الدكتور بطّل يشتغل معانا - يختفي من كل مكان ويفضل تاريخه" onClick={() => setActive(d, false)}>
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
                            <CampaignList doctor={d} campaigns={campaigns} canManage={canManage} onAdd={() => addCampaign(d)} onRename={(c) => renameCampaign(d, c)} />
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
  doctor,
  campaigns,
  canManage,
  onAdd,
  onRename,
}: {
  doctor: Doctor;
  campaigns: Campaign[] | null;
  canManage: boolean;
  onAdd: () => void;
  onRename: (c: Campaign) => void;
}) {
  return (
    <div className="actions" style={{ flexDirection: 'column', alignItems: 'stretch' }} aria-label={`كامبينات ${doctor.name}`}>
      {campaigns === null ? (
        <span className="sub">بيحمّل…</span>
      ) : campaigns.length === 0 ? (
        <span className="sub">مفيش كامبينات للدكتور ده لسه.</span>
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
            + كامبين جديد
          </button>
        </div>
      )}
    </div>
  );
}
