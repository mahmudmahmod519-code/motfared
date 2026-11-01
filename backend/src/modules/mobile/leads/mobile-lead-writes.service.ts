import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { Lead } from '../../leads/entities/lead.entity';
import { CallResult } from '../../call-results/entities/call-result.entity';
import { DoctorMessage } from '../../doctors/entities/doctor-message.entity';
import { MessageTemplate } from '../../message-templates/entities/message-template.entity';
import { User, UserStatus } from '../../users/entities/user.entity';
import { extractPhone, toCanonicalPhone } from '../../../common/phone/phone';
import { MobileLeadsService } from './mobile-leads.service';
import { MobileCallLogService } from '../call-log/mobile-call-log.service';
import { CreateMobileLeadDto, UpdateMobileLeadDto, WrittenContactDto } from './dto/mobile-lead-write.dto';
import { LEAD_GONE_MESSAGE, TERMINAL_LEAD_STATUSES, stamp } from './mobile-lead.wire';
import { DEFAULT_TEMPLATES, NO_BOOKING_BLANKS, buildContext, fill, renderTemplate, toInternational } from '../messages/templates';

const MAX_LEAD_NOTES = 2000;
const MAX_CONTACT_NOTE = 300;
const WRITTEN_CONTACT_CHANNELS = ['whatsapp'];

/** Trimmed text clipped to `max`, or null when there is nothing left (the legacy `str`). */
function str(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

const isDuplicateKey = (e: any) => (e?.code ?? e?.driverError?.code) === 'ER_DUP_ENTRY';

/**
 * The rep's writes to their own leads, with the legacy rules and messages. As for the reads, every
 * query carries the verified company, and a lead id from the app only resolves to this rep's own leads
 * (reopen is the one exception, by design: it is how a rep takes back a lead they once worked).
 */
@Injectable()
export class MobileLeadWritesService {
  constructor(
    @InjectRepository(LeadContact) private readonly contacts: Repository<LeadContact>,
    @InjectRepository(Lead) private readonly sources: Repository<Lead>,
    @InjectRepository(CallResult) private readonly results: Repository<CallResult>,
    @InjectRepository(DoctorMessage) private readonly doctorMessages: Repository<DoctorMessage>,
    @InjectRepository(MessageTemplate) private readonly templates: Repository<MessageTemplate>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly reads: MobileLeadsService,
    private readonly callLog: MobileCallLogService,
  ) {}

  private async leadView(companyId: string, userId: string, mobileId: number) {
    return (await this.reads.get(companyId, userId, mobileId)).lead;
  }

  /** The company's lead (any owner) that already uses this number in any of its three number columns. */
  private async findByNumber(companyId: string, key: string, exceptId?: string) {
    const qb = this.contacts
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.assigned_user', 'owner')
      .where('c.company_id = :companyId', { companyId })
      .andWhere('(c.phone_key = :key OR c.whatsapp_phone = :key OR c.alt_phone = :key)', { key })
      .orderBy('c.mobile_id', 'DESC')
      .limit(1);
    if (exceptId) qb.andWhere('c.id <> :exceptId', { exceptId });
    return qb.getOne();
  }

  private duplicateError(existing: LeadContact, userId: string) {
    const owner = existing.assigned_user;
    const mine = owner?.id === userId;
    const ownerActive = !!owner && [UserStatus.ACTIVE, UserStatus.PENDING].includes(owner.status);
    const message = mine
      ? `الرقم ده موجود عندك أصلاً باسم "${existing.name}"`
      : owner && ownerActive
        ? `الرقم ده موجود كليد باسم "${existing.name}" مع ${owner.name}`
        : `الرقم ده موجود كليد باسم "${existing.name}" ومش مع حد دلوقتي - تقدر ترجّعه من سجل الليدز`;
    return new ConflictException({ message, leadId: existing.mobile_id, leadName: existing.name, mine, ownerName: owner ? owner.name : null });
  }

  // ───────────────────────────── create ─────────────────────────────
  async create(companyId: string, userId: string, dto: CreateMobileLeadDto) {
    const name = str(dto.name, 120);
    if (!name) throw new BadRequestException('اكتب اسم العميل');
    const phone = extractPhone(String(dto.phone || ''));
    if (!phone) throw new BadRequestException('رقم التليفون مش صحيح - مصري زي 01xxxxxxxxx، أو أي دولة عربية بكود الدولة زي +966…');
    const waRaw = String(dto.whatsappPhone || '').trim();
    const whatsapp = waRaw ? extractPhone(waRaw) : null;
    if (waRaw && !whatsapp) throw new BadRequestException('رقم الواتساب مش صحيح');

    const existing = await this.findByNumber(companyId, phone);
    if (existing) throw this.duplicateError(existing, userId);

    const linked = await this.reads.linkedDoctors(companyId, userId);
    const chosen = dto.doctorId ? linked.find((d) => d.mobile_id === dto.doctorId) : linked[0];
    if (!chosen) throw new BadRequestException('لازم تكون مربوط بدكتور الأول عشان تضيف ليد - اطلب من الأدمن يربطك');

    let source = await this.sources.findOne({ where: { company_id: companyId, doctor_id: chosen.id }, order: { created_at: 'DESC' } });
    if (!source) {
      source = await this.sources.save(this.sources.create({ company_id: companyId, doctor_id: chosen.id, name: 'إدخال يدوي', source_type: 'manual' }));
    }

    const now = new Date();
    let saved: LeadContact;
    try {
      saved = await this.contacts.save(
        this.contacts.create({
          company_id: companyId,
          lead_id: source.id,
          name,
          phone,
          whatsapp_phone: whatsapp,
          notes: str(dto.notes, MAX_LEAD_NOTES),
          assigned_user_id: userId,
          claimed_at: now,
          first_claimed_at: now,
          work_status: 'new',
          source: 'rep',
        }),
      );
    } catch (e) {
      // Two simultaneous requests for one number: the unique key lets exactly one through.
      if (isDuplicateKey(e)) {
        const winner = await this.findByNumber(companyId, phone);
        if (winner) throw this.duplicateError(winner, userId);
      }
      throw e;
    }
    const mobileId = (await this.contacts.findOneByOrFail({ id: saved.id })).mobile_id;
    await this.callLog.attachCallsToLead(companyId, saved.id); // calls made to this number before the lead existed
    return { ok: true, lead: await this.leadView(companyId, userId, mobileId) };
  }

  // ───────────────────────────── update ─────────────────────────────
  async update(companyId: string, userId: string, mobileId: number, dto: UpdateMobileLeadDto) {
    const lead = await this.reads.ownLead(companyId, userId, mobileId);
    const updates: Partial<LeadContact> = {};

    if (dto.phone !== undefined || dto.whatsappPhone !== undefined) {
      if (lead.source !== 'rep') throw new BadRequestException('الرقم بيتعدل بس في الليد اللي إنت ضفته بنفسك');
      const nextPhone = dto.phone !== undefined ? toCanonicalPhone(String(dto.phone || '')) : toCanonicalPhone(lead.phone);
      if (!nextPhone) throw new BadRequestException('الرقم مش صحيح - مصري 11 رقم، أو دولة عربية بكود الدولة');
      const waRaw = dto.whatsappPhone !== undefined ? String(dto.whatsappPhone || '').trim() : null;
      const nextWhatsapp = waRaw === null ? lead.whatsapp_phone : waRaw ? toCanonicalPhone(waRaw) : null;
      if (waRaw && !nextWhatsapp) throw new BadRequestException('رقم الواتساب مش صحيح');
      for (const candidate of [nextPhone, nextWhatsapp]) {
        if (candidate && (await this.findByNumber(companyId, candidate, lead.id))) {
          throw new ConflictException('الرقم ده متسجل على ليد تاني');
        }
      }
      updates.phone = nextPhone;
      updates.phone_key = nextPhone;
      updates.whatsapp_phone = nextWhatsapp;
    }
    if (dto.name !== undefined) {
      const clean = str(dto.name, 200);
      if (!clean) throw new BadRequestException('اسم العميل مينفعش يكون فاضي');
      updates.name = clean;
    }
    if (dto.altName !== undefined) updates.alt_name = str(dto.altName, 200);
    if (dto.altPhone !== undefined) {
      const raw = String(dto.altPhone || '').trim();
      const cleanAlt = raw ? extractPhone(raw) : null;
      if (raw && !cleanAlt) throw new BadRequestException('الرقم التاني مش صحيح - مصري 11 رقم، أو دولة عربية بكود الدولة زي +966…');
      if (cleanAlt && [toCanonicalPhone(lead.phone), lead.whatsapp_phone].includes(cleanAlt)) {
        throw new BadRequestException('ده نفس رقم العميل - الرقم التاني لازم يكون رقم مختلف');
      }
      updates.alt_phone = cleanAlt;
      if (cleanAlt && cleanAlt !== lead.alt_phone) {
        // A second number the client gave is the client reaching out: it counts as contact evidence.
        updates.client_contact_at = new Date();
        updates.client_contact_via = 'second_number';
        updates.client_contact_note = null;
      }
    }
    if (dto.notes !== undefined) updates.notes = str(dto.notes, MAX_LEAD_NOTES);
    if (Object.keys(updates).length === 0) throw new BadRequestException('مفيش حاجة تتحدث');

    try {
      await this.contacts.update({ id: lead.id, company_id: companyId }, updates as any);
    } catch (e) {
      if (isDuplicateKey(e)) throw new ConflictException('الرقم ده متسجل على ليد تاني');
      throw e;
    }
    if (updates.phone !== undefined || updates.whatsapp_phone !== undefined || updates.alt_phone !== undefined) {
      await this.callLog.attachCallsToLead(companyId, lead.id); // a number the lead has just learned may already have been called
    }
    return { ok: true, lead: await this.leadView(companyId, userId, mobileId) };
  }

  // ───────────────────────────── delete ─────────────────────────────
  async remove(companyId: string, userId: string, mobileId: number) {
    const lead = await this.reads.ownLead(companyId, userId, mobileId);
    if (lead.source !== 'rep') throw new BadRequestException('بيتمسح بس الليد اللي إنت ضفته بنفسك');
    // TODO(B6): refuse when the lead has a booking ("الليد ده عليه حجز - مينفعش يتمسح").
    // Its call results go with it (foreign key cascade), as the legacy backend deleted them.
    await this.contacts.delete({ id: lead.id, company_id: companyId });
    return { ok: true, id: mobileId };
  }

  // ───────────────────────────── reopen ─────────────────────────────
  async reopen(companyId: string, userId: string, mobileId: number) {
    const lead = await this.contacts
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.assigned_user', 'owner')
      .where('c.company_id = :companyId AND c.mobile_id = :mobileId', { companyId, mobileId })
      .getOne();
    if (!lead) throw new NotFoundException('الليد ده مش موجود');

    const mine = lead.assigned_user_id === userId;
    const touched = await this.results.count({ where: { company_id: companyId, lead_contact_id: lead.id, user_id: userId } });
    if (!mine && !touched) throw new ForbiddenException('الليد ده مش من سجلك');
    const owner = lead.assigned_user;
    const ownerActive = !!owner && [UserStatus.ACTIVE, UserStatus.PENDING].includes(owner.status);
    if (!mine && owner && ownerActive) {
      throw new ConflictException({ message: `الليد ده مع ${owner.name} دلوقتي - اطلب من الأدمن ينقله ليك`, ownerName: owner.name });
    }

    const now = new Date();
    const reopened = TERMINAL_LEAD_STATUSES.includes(lead.work_status);
    await this.contacts.manager.transaction(async (m) => {
      await m.update(
        LeadContact,
        { id: lead.id, company_id: companyId },
        {
          assigned_user_id: userId,
          claimed_at: now,
          first_claimed_at: lead.first_claimed_at ?? lead.claimed_at ?? now,
          client_contact_at: now,
          client_contact_via: 'callback',
          client_contact_note: null,
          whatsapp_sent_at: null,
          work_status: reopened ? 'follow_up' : lead.work_status,
        },
      );
      // On the timeline as its own event, not as a call the rep made.
      await m.save(CallResult, m.create(CallResult, { company_id: companyId, lead_contact_id: lead.id, user_id: userId, outcome: 'follow_up', kind: 'manual' }));
    });
    return { ok: true, reopened, previousStatus: lead.work_status, lead: await this.leadView(companyId, userId, mobileId) };
  }

  // ───────────────────────────── written contact / WhatsApp ─────────────────────────────
  async writtenContact(companyId: string, userId: string, mobileId: number, dto: WrittenContactDto) {
    const lead = await this.reads.ownLead(companyId, userId, mobileId);
    const raw = dto.contactedVia;
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      throw new BadRequestException({ message: 'اختار وسيلة التواصل', contactedViaOptions: WRITTEN_CONTACT_CHANNELS });
    }
    const via = String(raw).trim().toLowerCase();
    if (!WRITTEN_CONTACT_CHANNELS.includes(via)) {
      throw new BadRequestException(`وسيلة تواصل مش مدعومة - المتاح: ${WRITTEN_CONTACT_CHANNELS.join('، ')}`);
    }
    const note = str(dto.contactNote, MAX_CONTACT_NOTE);
    if (!note) throw new BadRequestException('اكتب سبب مختصر - العميل قال إيه في المحادثة');

    await this.contacts.update({ id: lead.id, company_id: companyId }, { client_contact_at: new Date(), client_contact_via: via, client_contact_note: note });
    return { ok: true, lead: await this.leadView(companyId, userId, mobileId) };
  }

  async whatsappSent(companyId: string, userId: string, mobileId: number) {
    const lead = await this.reads.ownLead(companyId, userId, mobileId);
    // One atomic statement, so simultaneous taps are all counted.
    await this.contacts
      .createQueryBuilder()
      .update(LeadContact)
      .set({ whatsapp_sent_at: new Date(), whatsapp_count: () => 'whatsapp_count + 1' })
      .where('id = :id AND company_id = :companyId', { id: lead.id, companyId })
      .execute();
    // TODO(B6): mark due booking reminders as messaged when the bookings package exists.
    const fresh = await this.contacts.findOneByOrFail({ id: lead.id });
    return { ok: true, whatsappCount: fresh.whatsapp_count, whatsappSentAt: stamp(fresh.whatsapp_sent_at) };
  }

  // ───────────────────────────── messages ─────────────────────────────
  private async contextFor(lead: LeadContact) {
    return buildContext({
      lead: { name: lead.name, phone: lead.phone, whatsapp_phone: lead.whatsapp_phone, rep_name: lead.assigned_user?.name ?? null, doctor_name: lead.lead?.doctor?.name ?? null },
      booking: null, // TODO(B6): the lead's latest booking
    });
  }

  async doctorMessagesFor(companyId: string, userId: string, mobileId: number) {
    const lead = await this.reads.ownLead(companyId, userId, mobileId, true);
    const doctor = lead.lead?.doctor;
    if (!doctor || doctor.company_id !== companyId) return { doctorId: null, doctorName: null, messages: [] as unknown[] };

    // With no booking yet, a message that quotes the appointment keeps each blank as a visible bracketed
    // word the rep overwrites in WhatsApp before sending, rather than going out with empty gaps.
    const context = { ...(await this.contextFor(lead)), ...NO_BOOKING_BLANKS };
    const rows = await this.doctorMessages.find({ where: { company_id: companyId, doctor_id: doctor.id }, order: { sort_order: 'ASC', created_at: 'ASC' } });
    const messages = rows.map((m) => {
      const text = fill(m.body, context);
      return { id: m.mobile_id, title: m.title, text, whatsappUrl: `https://wa.me/${toInternational(lead.whatsapp_phone || lead.phone)}?text=${encodeURIComponent(text)}` };
    });
    return { doctorId: doctor.mobile_id, doctorName: doctor.name, messages };
  }

  async messageFor(companyId: string, userId: string, mobileId: number, key: string) {
    const lead = await this.reads.ownLead(companyId, userId, mobileId, true);
    const own = await this.templates.findOne({ where: { company_id: companyId, key } });
    const template = own ? { key: own.key, label: own.label, body: own.body } : DEFAULT_TEMPLATES.find((t) => t.key === key);
    if (!template) throw new NotFoundException('القالب ده مش موجود');
    return renderTemplate(template, await this.contextFor(lead));
  }
}

export { LEAD_GONE_MESSAGE };
