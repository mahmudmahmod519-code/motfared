/**
 * Copy-ready message rendering, ported from the legacy backend's templates.js as pure functions.
 *
 * The wording lives in the database (per company, with the shipped defaults below as the fallback), so
 * an admin can reword a message and every rep picks it up on the next refresh without a new APK. The
 * server renders it, not the app, so the app and the dashboard can never show customers differently
 * worded messages.
 */

export interface MessageTemplateDef {
  key: string;
  label: string;
  body: string;
}

const BOOKING_SUMMARY_BODY =
  'اسم الحالة: {{case_name}}\nاسم العميل: {{lead_name}}\nرقم التليفون: {{lead_phone}}\nالدكتور: {{doctor_name}}\nالخدمة: {{service_name}}\nاليوم: {{scheduled_weekday}}\nالتاريخ: {{scheduled_date}}\nالساعة: {{scheduled_time}}\nالموظف: {{rep_name}}{{booking_notes}}';

/** The shipped templates, used when a company has not reworded one. */
export const DEFAULT_TEMPLATES: MessageTemplateDef[] = [
  { key: 'booking_summary', label: 'ملخص الحجز (للنسخ)', body: BOOKING_SUMMARY_BODY },
  {
    key: 'whatsapp_followup',
    label: 'رسالة واتساب للي مردش',
    body: 'أهلاً {{lead_name}} 👋\nحاولنا نتواصل معاك أكتر من مرة بخصوص حجز موعد مع {{doctor_name}}.\nياريت تردّ علينا وتقولنا الميعاد المناسب ليك ونحجزه على طول.\nشكراً لوقتك 🌟',
  },
  {
    key: 'reminder_call_script',
    label: 'نص مكالمة التذكير',
    body: 'تذكير: {{lead_name}} - {{lead_phone}}\nمعاده النهاردة {{scheduled_time}} مع {{doctor_name}}\nالخدمة: {{service_name}}\nأكّد الحضور واسأل لو محتاج يأجّل.',
  },
];

const ARABIC_WEEKDAYS = ['الأحد', 'الإتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

/**
 * WhatsApp deep links need a full international number, but leads are stored in the local `01…` form.
 * A wrong conversion opens WhatsApp on an empty chat rather than failing visibly, so it is done in one
 * place. A number that already carries its own country code (a Sudanese +249…) only loses the plus.
 */
export function toInternational(phone: unknown): string {
  const raw = String(phone ?? '').trim();
  if (raw.startsWith('+')) return raw.slice(1).replace(/\D/g, '');
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('20')) return digits;
  if (digits.startsWith('0')) return `20${digits.slice(1)}`;
  return `20${digits}`;
}

/**
 * Stored as 'YYYY-MM-DD HH:MM'. Parsed by hand rather than with `new Date()`, which would reinterpret the
 * string in the server's timezone: the appointment the client agreed to is a wall clock, not an instant.
 */
export function formatDateTime(value: unknown): { date: string; time: string; weekday: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return { date: String(value ?? ''), time: '', weekday: '' };
  const [, year, month, day, hour, minute] = match;
  const weekdayIndex = new Date(Date.UTC(+year, +month - 1, +day)).getUTCDay();
  const hour24 = +hour;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour12}:${minute} ${hour24 < 12 ? 'ص' : 'م'}`,
    weekday: ARABIC_WEEKDAYS[weekdayIndex] || '',
  };
}

export interface ContextLead {
  name?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  rep_name?: string | null;
  doctor_name?: string | null;
}
export interface ContextBooking {
  scheduled_for?: string | null;
  contacted_at?: string | null;
  notes?: string | null;
  case_name?: string | null;
  service_name?: string | null;
  booked_by?: string | null;
}
export type TemplateContext = Record<string, string>;

/** Everything a template is allowed to reference, gathered for one lead (and its booking, once bookings exist). */
export function buildContext({ lead, booking = null }: { lead: ContextLead; booking?: ContextBooking | null }): TemplateContext {
  const scheduled = formatDateTime(booking?.scheduled_for);
  const contacted = formatDateTime(booking?.contacted_at);
  return {
    lead_name: lead.name || '',
    // The patient, when the booking names one; otherwise the client is the patient, so a template that
    // says {{case_name}} never prints an empty line for the usual case.
    case_name: booking?.case_name || lead.name || '',
    lead_phone: lead.phone || '',
    lead_whatsapp: lead.whatsapp_phone || lead.phone || '',
    // The line the client messages from, often not the one they answer calls on.
    lead_phone_intl: toInternational(lead.whatsapp_phone || lead.phone),
    doctor_name: lead.doctor_name || '',
    rep_name: booking?.booked_by || lead.rep_name || '',
    service_name: booking?.service_name || '',
    scheduled_date: scheduled.date,
    scheduled_time: scheduled.time,
    scheduled_weekday: scheduled.weekday,
    contacted_date: contacted.date,
    contacted_time: contacted.time,
    // Carries its own label and leading newline, so a template that ends with it shows nothing extra
    // when there is no note (fill() only substitutes; it has no conditional blocks).
    booking_notes: booking?.notes ? `\nملاحظات: ${booking.notes}` : '',
  };
}

/** The appointment placeholders of a lead with no booking yet: visible bracketed words the rep overwrites before sending. */
export const NO_BOOKING_BLANKS: TemplateContext = {
  scheduled_date: '[التاريخ]',
  scheduled_time: '[الساعة]',
  scheduled_weekday: '[اليوم]',
  contacted_date: '[التاريخ]',
  contacted_time: '[الساعة]',
  booking_notes: '',
};

/** Substitutes `{{placeholder}}`; an unknown one becomes empty so a typo never reaches a customer as `{{lead_nmae}}`. */
export function fill(body: unknown, context: Record<string, string>): string {
  return String(body ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => (Object.prototype.hasOwnProperty.call(context, key) ? context[key] : ''));
}

/**
 * The booking summary with the case line the clinic must not miss: a summary that names no case gets
 * the line put in above the client's name (or on top), only when the booking names a different patient.
 */
export function withCaseLine(body: string, context: { case_name?: string; lead_name?: string }): string {
  if (/\{\{\s*case_name\s*\}\}/.test(body)) return body;
  if (!context.case_name || context.case_name === context.lead_name) return body;
  const lines = String(body || '').split('\n');
  const at = lines.findIndex((line) => /\{\{\s*lead_name\s*\}\}/.test(line));
  lines.splice(Math.max(at, 0), 0, 'اسم الحالة: {{case_name}}');
  return lines.join('\n');
}

export function renderTemplate(template: MessageTemplateDef, context: TemplateContext) {
  const body = template.key === 'booking_summary' ? withCaseLine(template.body, context) : template.body;
  const text = fill(body, context);
  return {
    key: template.key,
    label: template.label,
    text,
    // Pre-built so the app can open the chat with one tap.
    whatsappUrl: `https://wa.me/${context.lead_phone_intl}?text=${encodeURIComponent(text)}`,
  };
}

/** Every name fill() knows; a template save is checked against this so a typo is refused, not blanked in every message. */
export const PLACEHOLDER_KEYS = [
  'lead_name', 'case_name', 'lead_phone', 'lead_whatsapp', 'lead_phone_intl', 'doctor_name', 'rep_name',
  'service_name', 'scheduled_date', 'scheduled_time', 'scheduled_weekday', 'contacted_date', 'contacted_time', 'booking_notes',
];

/** The {{names}} in a body that fill() would blank. */
export function unknownPlaceholders(body: unknown): string[] {
  const seen = new Set<string>();
  for (const m of String(body ?? '').matchAll(/\{\{(\w+)\}\}/g)) if (!PLACEHOLDER_KEYS.includes(m[1])) seen.add(m[1]);
  return [...seen];
}
