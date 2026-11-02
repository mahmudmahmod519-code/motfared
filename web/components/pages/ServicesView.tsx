'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, apiRequest } from '../../lib/http';
import type { Service } from '../../lib/types';
import { useDialogs } from '../ui/useDialogs';
import { useToasts } from '../ui/useToasts';

/** The original's services page (loadServices / addService / renameService in app.js) on /api/services. */
export function ServicesView({ initial, canManage }: { initial: Service[]; canManage: boolean }) {
  const [services, setServices] = useState(initial);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const { toast, toasts } = useToasts();
  const { promptDialog, dialog } = useDialogs();

  const reload = async () => setServices(await apiRequest<Service[]>('/services'));

  /** Runs one change; a refusal is shown as the original showed it, in a toast that stays. */
  async function attempt(run: () => Promise<void>) {
    try {
      await run();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'حصلت مشكلة، جرّب تاني', 'bad');
    }
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name || adding) return;
    setAdding(true);
    await attempt(async () => {
      await apiRequest('/services', { method: 'POST', body: { name } });
      form.reset();
      toast(`اتضافت خدمة ${name}`, 'good');
      await reload();
    });
    setAdding(false);
  }

  async function toggle(svc: Service) {
    setBusyId(svc.id);
    await attempt(async () => {
      await apiRequest(`/services/${svc.id}`, { method: 'PATCH', body: { active: !svc.active } });
      toast(svc.active ? `اتوقفت خدمة ${svc.name}` : `اتفعّلت خدمة ${svc.name}`, 'good');
      await reload();
    });
    setBusyId(null);
  }

  async function rename(svc: Service) {
    const name = await promptDialog('تعديل اسم الخدمة', { label: 'الاسم', value: svc.name });
    if (!name || !name.trim() || name.trim() === svc.name) return;
    await attempt(async () => {
      await apiRequest(`/services/${svc.id}`, { method: 'PATCH', body: { name: name.trim() } });
      toast('اتعدّل اسم الخدمة', 'good');
      await reload();
    });
  }

  return (
    <section id="services-section">
      <h3>الخدمات</h3>
      {canManage && (
        <form className="svc-add" onSubmit={add}>
          <label htmlFor="new-service-name" className="sr-only">
            اسم خدمة جديدة
          </label>
          {/* min-width 0: a text input will not shrink below its default width in a flex row, which pushed the
              page sideways on a phone (the original has the same overflow at 375px). */}
          <input type="text" id="new-service-name" name="name" placeholder="اسم خدمة جديدة" maxLength={255} style={{ minWidth: 0 }} />
          <button type="submit" className="primary" id="add-service-btn" disabled={adding}>
            + إضافة
          </button>
        </form>
      )}
      <div id="services-list" className="card svc-list">
        {services.map((svc) => (
          <div key={svc.id} className={svc.active ? 'svc-row' : 'svc-row off'}>
            <div className="svc-name">
              <span title={svc.name}>{svc.name}</span>
            </div>
            <span className="badge svc-state">{svc.active ? 'شغّالة' : 'موقوفة'}</span>
            {canManage && (
              <div className="svc-actions">
                <button type="button" onClick={() => rename(svc)}>
                  تعديل الاسم
                </button>
                <button type="button" disabled={busyId === svc.id} onClick={() => toggle(svc)}>
                  {svc.active ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {dialog}
      {toasts}
    </section>
  );
}
