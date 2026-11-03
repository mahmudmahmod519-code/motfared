'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, apiRequest } from '../../lib/http';
import { buildChanges, fromProfile } from '../../lib/company-settings';
import { TERM_KEYS, withAl, type FeatureKey, type TermKey, type Terms } from '../../lib/terms';
import type { CompanyProfileDetails, IndustryTemplate } from '../../lib/types';
import { useToasts } from '../ui/useToasts';

/** The words a company can rename, as pairs where the screens use both the singular and the plural. */
const TERM_ROWS: { label: string; hint?: string; one: TermKey; many?: TermKey }[] = [
  { label: 'الجهة', hint: 'اللي الليدز والكامبينات تابعة لها: دكتور، فرع، مشروع…', one: 'unit', many: 'units' },
  { label: 'الكامبين', one: 'campaign', many: 'campaigns' },
  { label: 'العميل', one: 'client', many: 'clients' },
  { label: 'الخدمة', hint: 'اللي الشركة بتقدّمه: خدمة، منتج، وحدة…', one: 'service', many: 'services' },
  { label: 'الحجز', hint: 'الميعاد اللي العميل بيحضر فيه', one: 'booking', many: 'bookings' },
  { label: 'السيلز', one: 'rep', many: 'reps' },
  { label: 'رئيس الفريق', one: 'team_lead' },
  { label: 'العميل حضر', hint: 'بتظهر لما العميل يحضر: اتكشف، اتعملت المعاينة…', one: 'attended' },
  { label: 'متابعة ما بعد الحجز', hint: 'في العيادات: الخطة العلاجية', one: 'plan' },
];

const FEATURE_ROWS: { key: FeatureKey; label: string; hint: (t: Terms) => string }[] = [
  { key: 'plan_followup', label: 'متابعة ما بعد الحجز', hint: (t) => `صفحة "${t.plan}" في القائمة.` },
  { key: 'unit_report', label: 'التقرير المطبوع', hint: (t) => `صفحة "تقرير ${withAl(t.unit)}" في القائمة.` },
  { key: 'unit_portal', label: 'صفحة خاصة لكل جهة', hint: (t) => `لينك ${withAl(t.unit)} يشوف منه حجوزاته. (الصفحة لسه بتتبني)` },
  { key: 'public_form', label: 'فورم التسجيل العام', hint: () => 'صفحة عامة العملاء يسجّلوا منها بياناتهم. (الصفحة لسه بتتبني)' },
];

const MAX_TERM = 40;

/** A new SaaS page (not in the original), built from the dashboard's own tokens and components. */
export function CompanySettingsView({ initial, industries, canWrite }: { initial: CompanyProfileDetails; industries: IndustryTemplate[]; canWrite: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(() => fromProfile(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { toast, toasts } = useToasts();

  const template = industries.find((i) => i.key === form.industry) ?? industries[0];
  // What the dashboard will say once saved: the chosen template with the typed words on top.
  const preview = Object.fromEntries(TERM_KEYS.map((k) => [k, form.terms[k].trim() || template.terms[k]])) as Terms;
  const logoOk = !form.logo.trim() || /^https:\/\/\S+$/.test(form.logo.trim());

  const setTerm = (k: TermKey, v: string) => setForm((f) => ({ ...f, terms: { ...f.terms, [k]: v } }));

  /** A new industry brings its own features; the owner's own words stay typed in. */
  function chooseIndustry(key: string) {
    const next = industries.find((i) => i.key === key);
    setForm((f) => ({ ...f, industry: key, features: next ? { ...next.features } : f.features }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || busy) return;
    if (!form.name.trim()) return setError('اسم الشركة مطلوب');
    if (!logoOk) return setError('رابط اللوجو لازم يبدأ بـ https://');
    const body = buildChanges(saved, form, template);
    if (!Object.keys(body).length) return toast('مفيش تغييرات تتحفظ');
    setBusy(true);
    setError('');
    try {
      const next = await apiRequest<CompanyProfileDetails>('/company-profile', { method: 'PATCH', body });
      setSaved(next);
      setForm(fromProfile(next));
      toast('اتحفظت إعدادات الشركة', 'good');
      router.refresh(); // the menu, the name in the sidebar and every page's words follow
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'حصلت مشكلة، جرّب تاني');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} noValidate>
      {!canWrite && <p className="hint">الاشتراك منتهي: تقدر تشوف الإعدادات بس، ومش هتقدر تغيّرها لحد ما الاشتراك يتجدّد.</p>}
      <fieldset disabled={!canWrite || busy} className="settings-fieldset">
        <section>
          <h3>بيانات الشركة</h3>
          <div className="card settings-card">
            <div className="field">
              <label htmlFor="company-name">اسم الشركة</label>
              <input id="company-name" type="text" maxLength={255} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="company-logo">رابط اللوجو</label>
              <div className="logo-row">
                <input id="company-logo" type="text" inputMode="url" dir="ltr" placeholder="https://…" maxLength={1000} value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} aria-describedby="company-logo-hint" />
                {form.logo.trim() && logoOk && (
                  // eslint-disable-next-line @next/next/no-img-element -- the company's own logo from any https host
                  <img className="logo-preview" src={form.logo.trim()} alt="معاينة اللوجو" />
                )}
              </div>
              <div className="settings-hint" id="company-logo-hint">
                {logoOk ? 'رابط https لصورة اللوجو. بيظهر في القائمة مكان العلامة. سيبه فاضي عشان تشيله.' : 'الرابط لازم يبدأ بـ https://'}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3>مجال الشركة</h3>
          <div className="card settings-card">
            <div className="field">
              <label htmlFor="company-industry">المجال</label>
              <select id="company-industry" value={form.industry} onChange={(e) => chooseIndustry(e.target.value)} aria-describedby="company-industry-hint">
                {industries.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </select>
              <div className="settings-hint" id="company-industry-hint">
                المجال بيحدد الكلمات والمميزات الافتراضية. الكلمات اللي كتبتها بنفسك تحت بتفضل زي ما هي.
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3>المصطلحات</h3>
          <p className="hint">اكتب الكلمة اللي شركتك بتستخدمها. الخانة الفاضية معناها الكلمة الافتراضية للمجال (المكتوبة باهتة).</p>
          <div className="card terms-table">
            <div className="term-row head" aria-hidden="true">
              <span>المعنى</span>
              <span>مفرد</span>
              <span>جمع</span>
            </div>
            {TERM_ROWS.map((row) => (
              <div className="term-row" key={row.one}>
                <div className="what">
                  <strong>{row.label}</strong>
                  {row.hint && <span>{row.hint}</span>}
                </div>
                <input type="text" maxLength={MAX_TERM} className={row.many ? undefined : 'span-2'} aria-label={row.many ? `${row.label}: مفرد` : row.label} placeholder={template.terms[row.one]} value={form.terms[row.one]} onChange={(e) => setTerm(row.one, e.target.value)} />
                {row.many && (
                  <input type="text" maxLength={MAX_TERM} aria-label={`${row.label}: جمع`} placeholder={template.terms[row.many]} value={form.terms[row.many]} onChange={(e) => setTerm(row.many!, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3>المميزات</h3>
          <div className="card settings-card">
            {FEATURE_ROWS.map((f) => (
              <label className="feature-row" key={f.key}>
                <input type="checkbox" checked={form.features[f.key]} onChange={(e) => setForm({ ...form, features: { ...form.features, [f.key]: e.target.checked } })} />
                <div>
                  <strong>{f.label}</strong>
                  <span>
                    {f.hint(preview)} الافتراضي لمجالك: {template.features[f.key] ? 'شغّالة' : 'مقفولة'}.
                  </span>
                </div>
              </label>
            ))}
          </div>
        </section>
      </fieldset>

      {canWrite && (
        <div className="settings-actions">
          <button type="submit" className="primary" disabled={busy}>
            حفظ التغييرات
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setForm(fromProfile(saved));
              setError('');
            }}
          >
            تراجع
          </button>
        </div>
      )}
      <p className="error" role="alert">
        {error}
      </p>
      {toasts}
    </form>
  );
}
