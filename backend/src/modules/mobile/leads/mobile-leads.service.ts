import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LeadContact } from '../../lead-contacts/entities/lead-contact.entity';
import { CallResult } from '../../call-results/entities/call-result.entity';
import { UserDoctor } from '../../doctors/entities/user-doctor.entity';
import { Service, ServiceStatus } from '../../services/entities/service.entity';
import { UserStatus } from '../../users/entities/user.entity';
import { MobileCallLogService } from '../call-log/mobile-call-log.service';
import { addDays, cairoDay, cairoDayRange } from '../../../common/clock/cairo-clock';
import { escapeLike, foldSql, foldText } from '../../../common/text/arabic-fold';
import { AttemptHistory, decorateLeads } from '../lifecycle/lifecycle';
import {
  HISTORY_PAGE_SIZE_MAX, LEAD_GONE_MESSAGE, LEAD_LIST_RECENT_DAYS, TERMINAL_LEAD_STATUSES,
  orderForCalling, stamp, toWireLead, toWirePhoneCall,
} from './mobile-lead.wire';

const DOCTOR_SLOT_ORDER = ['primary', 'secondary', 'tertiary'];

const ACTIVITY_OUTCOME_LABELS: Record<string, string> = {
  no_answer: 'لم يرد', very_interested: 'مهتم جداً', interested: 'مهتم', not_interested: 'غير مهتم',
  booked: 'تم الحجز', examined: 'تم الكشف', no_show: 'محضرش', follow_up: 'متابعة لاحقة',
  unreachable: 'مقفول - مبيردش', reminder_confirmed: 'تأكيد حضور', reminder_no_answer: 'تذكير - لم يرد',
  reminder_cancelled: 'تذكير - إلغاء', reminder_rescheduled: 'تذكير - تأجيل',
};
const WRITTEN_CONTACT_LABELS: Record<string, string> = {
  whatsapp: 'العميل رد على واتساب', callback: 'العميل اتصل بينا', second_number: 'العميل ادانا رقم تاني',
};

/**
 * The rep-facing lead reads of the mobile API. Everything is scoped by the verified company AND the
 * caller's own ownership: a lead id from the app only ever resolves among this rep's leads (history
 * search additionally includes leads this rep has called), never another rep's or another company's.
 */
@Injectable()
export class MobileLeadsService {
  constructor(
    @InjectRepository(LeadContact) private readonly contacts: Repository<LeadContact>,
    @InjectRepository(CallResult) private readonly results: Repository<CallResult>,
    @InjectRepository(UserDoctor) private readonly links: Repository<UserDoctor>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    private readonly callLog: MobileCallLogService,
  ) {}

  private baseQuery() {
    return this.contacts
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.lead', 'src')
      .leftJoinAndSelect('src.doctor', 'doc')
      .leftJoinAndSelect('c.service', 'svc');
  }

  /** Call history for a batch of leads in one query, grouped per lead (never one query per lead). */
  private async historyFor(companyId: string, rows: LeadContact[]) {
    const history = new Map<number, AttemptHistory & { outcomes: number }>();
    for (const c of rows) history.set(c.mobile_id, { results: [], dials: [], firstClaimedAt: c.first_claimed_at, outcomes: 0 });
    if (!rows.length) return history;
    const byUuid = new Map(rows.map((c) => [c.id, c.mobile_id]));
    const found = await this.results.find({ where: { company_id: companyId, lead_contact_id: In([...byUuid.keys()]) } });
    for (const r of found) {
      const h = history.get(byUuid.get(r.lead_contact_id)!)!;
      h.results.push({ at: r.created_at, kind: r.kind, user_id: r.user_id });
      if (r.kind === 'lead') h.outcomes += 1;
    }
    // The phone's own outbound dials raise the attempt counts: a recorded outcome is one answer, not one ring.
    const dials = await this.callLog.dialsByLead(companyId, [...byUuid.keys()]);
    for (const [uuid, list] of dials) history.get(byUuid.get(uuid)!)!.dials = list;
    return history;
  }

  async decorate(companyId: string, rows: LeadContact[]) {
    const history = await this.historyFor(companyId, rows);
    const wire = rows.map((c) => toWireLead(c, history.get(c.mobile_id)!.outcomes));
    return decorateLeads(wire, history, new Date());
  }

  /** The rep's claimed leads that are still worth showing: anything open, plus anything finished in the last week. */
  async list(companyId: string, userId: string) {
    const recentSince = cairoDayRange(addDays(cairoDay(new Date()), -(LEAD_LIST_RECENT_DAYS - 1))).start;
    const rows = await this.baseQuery()
      .where('c.company_id = :companyId AND c.assigned_user_id = :userId AND c.claimed_at IS NOT NULL', { companyId, userId })
      .andWhere('(c.work_status NOT IN (:...terminal) OR c.claimed_at >= :recentSince)', { terminal: TERMINAL_LEAD_STATUSES, recentSince })
      .orderBy('c.created_at', 'DESC')
      .addOrderBy('c.mobile_id', 'DESC')
      .getMany();
    return { leads: orderForCalling(await this.decorate(companyId, rows)) };
  }

  async ownLead(companyId: string, userId: string, mobileId: number, withOwner = false) {
    const qb = this.baseQuery().where('c.company_id = :companyId AND c.assigned_user_id = :userId AND c.mobile_id = :mobileId', { companyId, userId, mobileId });
    if (withOwner) qb.leftJoinAndSelect('c.assigned_user', 'owner');
    const row = await qb.getOne();
    if (!row) throw new NotFoundException(LEAD_GONE_MESSAGE);
    return row;
  }

  /** One of the rep's own leads, fresh, in the same shape the list sends. */
  async get(companyId: string, userId: string, mobileId: number) {
    const row = await this.ownLead(companyId, userId, mobileId);
    return { lead: (await this.decorate(companyId, [row]))[0] };
  }

  /**
   * The rep's record: without a query, finished leads older than the working list keeps; with one,
   * every lead they ever held or called, matched by name (Arabic-folded) or by number digits.
   */
  async history(companyId: string, userId: string, params: { q?: unknown; page?: unknown; pageSize?: unknown }) {
    const page = Math.max(1, Math.floor(Number(params.page) || 1));
    const pageSize = Math.min(HISTORY_PAGE_SIZE_MAX, Math.max(1, Math.floor(Number(params.pageSize) || 50)));
    const q = String(params.q ?? '').trim().slice(0, 60);

    const qb = this.baseQuery()
      .leftJoinAndSelect('c.assigned_user', 'owner')
      .where('c.company_id = :companyId', { companyId });

    if (q) {
      const digits = q.replace(/\D/g, '');
      const like = `%${escapeLike(foldText(q))}%`;
      qb.andWhere(
        `(c.assigned_user_id = :userId OR EXISTS (SELECT 1 FROM spec_call_results cr WHERE cr.lead_contact_id = c.id AND cr.company_id = :companyId AND cr.user_id = :userId))`,
        { userId },
      );
      const nameMatch = `${foldSql('c.name')} LIKE :like ESCAPE '\\\\' OR ${foldSql('c.alt_name')} LIKE :like ESCAPE '\\\\'`;
      if (digits) {
        qb.andWhere(`(${nameMatch} OR c.phone LIKE :digits OR c.phone_key LIKE :digits OR c.whatsapp_phone LIKE :digits OR c.alt_phone LIKE :digits)`, { like, digits: `%${digits}%` });
      } else {
        qb.andWhere(`(${nameMatch})`, { like });
      }
    } else {
      const recentSince = cairoDayRange(addDays(cairoDay(new Date()), -(LEAD_LIST_RECENT_DAYS - 1))).start;
      qb.andWhere('c.assigned_user_id = :userId AND c.claimed_at IS NOT NULL AND c.work_status IN (:...terminal) AND c.claimed_at < :recentSince', {
        userId, terminal: TERMINAL_LEAD_STATUSES, recentSince,
      });
    }

    const total = await qb.getCount();
    const rows = await qb
      .addSelect('COALESCE(c.claimed_at, c.created_at)', 'sort_at')
      .orderBy('sort_at', 'DESC')
      .addOrderBy('c.mobile_id', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getMany();

    const decorated = await this.decorate(companyId, rows);
    const byMobileId = new Map(rows.map((c) => [c.mobile_id, c]));
    const leads = decorated.map((lead) => {
      const owner = byMobileId.get(lead.id)!.assigned_user;
      return {
        ...lead,
        mine: owner?.id === userId,
        ownerName: owner ? owner.name : null,
        ownerActive: owner ? [UserStatus.ACTIVE, UserStatus.PENDING].includes(owner.status) : null,
      };
    });
    return { leads, page, pageSize, total, hasMore: page * pageSize < total, q: q || null };
  }

  /** The lead's story: every recorded call, the WhatsApp, the client's written contact. (Bookings, reminders and phone calls join as their packages land.) */
  async activity(companyId: string, userId: string, mobileId: number) {
    const lead = await this.ownLead(companyId, userId, mobileId);
    const calls = await this.results
      .createQueryBuilder('cr')
      .leftJoinAndSelect('cr.user', 'u')
      .where('cr.company_id = :companyId AND cr.lead_contact_id = :id', { companyId, id: lead.id })
      .orderBy('cr.created_at', 'ASC')
      .getMany();

    const events: { type: string; time: string | null; label: string; repName: string | null; status?: string }[] = [];
    for (const call of calls) {
      events.push({
        type: call.kind === 'reminder' ? 'reminder_call' : call.kind === 'manual' ? 'status_update' : 'call',
        time: stamp(call.created_at),
        label: ACTIVITY_OUTCOME_LABELS[call.outcome] || call.outcome,
        repName: call.user?.name ?? null,
      });
    }
    if (lead.whatsapp_sent_at) {
      events.push({ type: 'whatsapp', time: stamp(lead.whatsapp_sent_at), label: 'اتبعتت رسالة واتساب', repName: null });
    }
    if (lead.client_contact_at) {
      events.push({
        type: 'written_contact',
        time: stamp(lead.client_contact_at),
        label: `${WRITTEN_CONTACT_LABELS[lead.client_contact_via ?? ''] || 'العميل تواصل معانا'}${lead.client_contact_note ? ` — ${lead.client_contact_note}` : ''}`,
        repName: null,
      });
    }
    const phoneCalls = (await this.callLog.phoneCallsFor(companyId, lead)).map((e) =>
      toWirePhoneCall({ id: e.mobile_id, phoneNumber: e.phone_number, direction: e.direction, durationSeconds: e.duration_seconds, occurredAt: e.occurred_at, repName: e.user?.name ?? null, leadId: e.lead_contact_id }),
    );
    // The client ringing us: answered or not, once the call is linked to the lead.
    for (const e of phoneCalls.filter((c) => c.matched && (c.direction === 'inbound' || c.direction === 'missed'))) {
      const talked = e.direction === 'inbound' && e.durationSeconds > 0;
      const minutes = Math.floor(e.durationSeconds / 60);
      const length = talked ? ` (${minutes ? `${minutes}د ` : ''}${e.durationSeconds % 60}ث)` : '';
      events.push({ type: 'inbound_call', time: stamp(new Date(e.occurredAt)), label: talked ? `العميل اتصل واترد عليه${length}` : 'العميل اتصل ومحدش رد', repName: e.repName });
    }
    events.sort((a, b) => ((a.time ?? '') < (b.time ?? '') ? -1 : (a.time ?? '') > (b.time ?? '') ? 1 : 0));

    return {
      events,
      phoneCalls,
      counts: { outcomes: calls.filter((c) => c.kind === 'lead').length, dials: phoneCalls.filter((c) => c.direction === 'outbound' && c.matched).length },
    };
  }

  /** The rep's linked doctors in slot order (primary first); links that point outside the company are ignored. */
  async linkedDoctors(companyId: string, userId: string) {
    const rows = await this.links.find({ where: { company_id: companyId, user_id: userId }, relations: ['doctor'] });
    return rows
      .filter((l) => l.doctor && l.doctor.company_id === companyId)
      .sort((a, b) => DOCTOR_SLOT_ORDER.indexOf(a.rank) - DOCTOR_SLOT_ORDER.indexOf(b.rank))
      .map((l) => l.doctor);
  }

  /** The doctors this rep can add a lead under, primary first. */
  async doctors(companyId: string, userId: string) {
    return { doctors: (await this.linkedDoctors(companyId, userId)).map((d) => ({ id: d.mobile_id, name: d.name })) };
  }

  async servicesList(companyId: string) {
    const rows = await this.services.find({ where: { company_id: companyId, status: ServiceStatus.ACTIVE }, order: { mobile_id: 'ASC' } });
    return { services: rows.map((s) => ({ id: s.mobile_id, name: s.name })) };
  }
}
