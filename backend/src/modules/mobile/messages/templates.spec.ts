import {
  DEFAULT_TEMPLATES, PLACEHOLDER_KEYS, buildContext, fill, formatDateTime, renderTemplate, toInternational, unknownPlaceholders, withCaseLine,
} from './templates';

/** Ported from the legacy backend's test/templates.test.js, over plain data instead of a database. */
const lead = { name: 'منى خالد', phone: '01098765432', whatsapp_phone: '01512345678', rep_name: 'مندوب أ', doctor_name: 'د. كرماني' };
const single = { name: 'عميل برقم واحد', phone: '01011112222', whatsapp_phone: null, rep_name: 'مندوب أ', doctor_name: 'د. كرماني' };
const booking = { scheduled_for: '2026-08-25 14:30', contacted_at: '2026-08-23 10:00', notes: null, case_name: null, service_name: 'تقويم', booked_by: 'مندوب أ' };
const tpl = (key: string) => DEFAULT_TEMPLATES.find((t) => t.key === key)!;

describe('message templates', () => {
  it('converts a local number to the international form wa.me needs', () => {
    expect(toInternational('01012345678')).toBe('201012345678');
    expect(toInternational('201012345678')).toBe('201012345678');
    expect(toInternational('+201012345678')).toBe('201012345678');
    expect(toInternational('+249912345678')).toBe('249912345678'); // another country keeps its code
  });

  it('formats an appointment as a wall clock, not an instant', () => {
    const afternoon = formatDateTime('2026-08-25 14:30');
    expect(afternoon).toEqual({ date: '2026-08-25', time: '2:30 م', weekday: 'التلات' });
    expect(formatDateTime('2026-08-25 00:05').time).toBe('12:05 ص'); // midnight is 12 ص, not 0
    expect(formatDateTime('2026-08-25 12:00').time).toBe('12:00 م'); // noon is 12 م
    expect(formatDateTime('2026-08-25T14:30').date).toBe('2026-08-25');
    expect(formatDateTime('nonsense').time).toBe(''); // unparseable gives empty, never a wrong date
  });

  it('fills every placeholder in the booking summary', () => {
    const r = renderTemplate(tpl('booking_summary'), buildContext({ lead, booking }));
    for (const part of ['منى خالد', 'د. كرماني', '2026-08-25', '2:30 م']) expect(r.text).toContain(part);
    expect(r.text).not.toContain('{{');
  });

  it('a booking note appears labelled; no note leaves no trailing label at all', () => {
    expect(renderTemplate(tpl('booking_summary'), buildContext({ lead, booking: { ...booking, notes: 'محتاج ينزل بدري' } })).text).toContain('ملاحظات: محتاج ينزل بدري');
    expect(renderTemplate(tpl('booking_summary'), buildContext({ lead, booking })).text).not.toContain('ملاحظات');
  });

  it('a summary edited without {{case_name}} still names the case when the booking does', () => {
    const edited = { key: 'booking_summary', label: 'x', body: 'اسم العميل: {{lead_name}}\nرقم التليفون: {{lead_phone}}\nالساعة: {{scheduled_time}}' };
    expect(renderTemplate(edited, buildContext({ lead, booking })).text).toBe('اسم العميل: منى خالد\nرقم التليفون: 01098765432\nالساعة: 2:30 م');
    const forChild = buildContext({ lead, booking: { ...booking, case_name: 'يوسف ابن منى' } });
    expect(renderTemplate(edited, forChild).text).toBe('اسم الحالة: يوسف ابن منى\nاسم العميل: منى خالد\nرقم التليفون: 01098765432\nالساعة: 2:30 م');
    const noClient = { ...edited, body: 'حجز {{scheduled_time}} - {{lead_phone}}' };
    expect(renderTemplate(noClient, forChild).text).toBe('اسم الحالة: يوسف ابن منى\nحجز 2:30 م - 01098765432');
    const carries = { ...edited, body: 'الحالة {{case_name}} للعميل {{lead_name}}' };
    expect(renderTemplate(carries, forChild).text).toBe('الحالة يوسف ابن منى للعميل منى خالد');
    expect(renderTemplate(tpl('reminder_call_script'), forChild).text).not.toContain('يوسف'); // only the summary gets the case line
    expect(withCaseLine('x {{case_name}}', { case_name: 'a', lead_name: 'b' })).toBe('x {{case_name}}');
  });

  it('an unknown placeholder renders empty rather than leaking braces', () => {
    expect(fill('مرحبا {{lead_nmae}} و {{lead_name}}', { lead_name: 'منى' })).toBe('مرحبا  و منى');
    expect(unknownPlaceholders('{{lead_name}} {{lead_nmae}} {{lead_nmae}}')).toEqual(['lead_nmae']);
    expect(PLACEHOLDER_KEYS).toContain('booking_notes');
  });

  it('the wa.me link uses the WhatsApp line when the lead has one, else the contact number, url-encoded', () => {
    const withSeparate = renderTemplate(tpl('whatsapp_followup'), buildContext({ lead }));
    expect(withSeparate.whatsappUrl.startsWith('https://wa.me/201512345678')).toBe(true);
    expect(renderTemplate(tpl('whatsapp_followup'), buildContext({ lead: single })).whatsappUrl.startsWith('https://wa.me/201011112222')).toBe(true);
    expect(decodeURIComponent(withSeparate.whatsappUrl.split('?text=')[1])).toBe(withSeparate.text);
  });

  it('ships the three default templates with their Arabic labels', () => {
    expect(DEFAULT_TEMPLATES.map((t) => [t.key, t.label])).toEqual([
      ['booking_summary', 'ملخص الحجز (للنسخ)'],
      ['whatsapp_followup', 'رسالة واتساب للي مردش'],
      ['reminder_call_script', 'نص مكالمة التذكير'],
    ]);
    expect(tpl('booking_summary').body).toContain('{{booking_notes}}');
  });

  it('a lead with no booking keeps the appointment placeholders as visible blanks when asked to', () => {
    const ctx = buildContext({ lead, booking: null });
    expect(ctx.scheduled_date).toBe('');
    expect(fill('يوم {{scheduled_weekday}} الساعة {{scheduled_time}}', { ...ctx, ...{ scheduled_weekday: '[اليوم]', scheduled_time: '[الساعة]' } })).toBe('يوم [اليوم] الساعة [الساعة]');
  });
});
