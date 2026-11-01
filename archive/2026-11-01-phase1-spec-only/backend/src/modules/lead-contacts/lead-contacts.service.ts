import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadContact, LeadContactStatus } from './entities/lead-contact.entity';
import { CreateLeadContactDto } from './dto/create-lead-contact.dto';
import { UpdateLeadContactDto } from './dto/update-lead-contact.dto';
import { TenantService } from '../../common/tenant/tenant.service';
import { ConflictException } from '@nestjs/common';
import { toCanonicalPhone } from '../../common/phone/phone';

@Injectable()
export class LeadContactsService {
  constructor(
    @InjectRepository(LeadContact)
    private readonly repo: Repository<LeadContact>,
    private readonly tenant: TenantService,
  ) {}

  async create(dto: CreateLeadContactDto) {
    await this.tenant.assertOwned('lead', dto.lead_id, dto.company_id);
    const contact = this.repo.create(dto);
    return this.repo.save(contact).catch(rethrowDuplicatePhone);
  }

  async findAll(companyId?: string, leadId?: string, status?: LeadContactStatus) {
    const qb = this.repo.createQueryBuilder('contact')
      .leftJoinAndSelect('contact.lead', 'lead')
      .leftJoinAndSelect('contact.calls', 'calls')
      .orderBy('contact.created_at', 'DESC');

    if (companyId) {
      qb.andWhere('contact.company_id = :companyId', { companyId });
    }
    if (leadId) {
      qb.andWhere('contact.lead_id = :leadId', { leadId });
    }
    if (status) {
      qb.andWhere('contact.status = :status', { status });
    }

    return qb.getMany();
  }

  async findOne(id: string, companyId?: string) {
    const contact = await this.repo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
      relations: ['lead', 'calls', 'calls.call_center_user'],
    });
    if (!contact) throw new NotFoundException(`Lead contact ${id} not found`);
    return contact;
  }

  async update(id: string, dto: UpdateLeadContactDto, companyId?: string) {
    const existing = await this.findOne(id, companyId);
    const { company_id: _ignored, ...changes } = dto as any;
    if (changes.lead_id && changes.lead_id !== existing.lead_id) {
      await this.tenant.assertOwned('lead', changes.lead_id, existing.company_id);
    }
    // repo.update() skips entity listeners, so keep the canonical duplicate key in step with the phone.
    if (changes.phone !== undefined) changes.phone_key = changes.phone ? toCanonicalPhone(changes.phone) : null;
    await this.repo.update(id, changes).catch(rethrowDuplicatePhone);
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    await this.repo.delete(id);
    return { message: 'Lead contact deleted' };
  }

  /**
   * Internal: callers pass rows already stamped with a verified company/lead. A row whose phone already
   * belongs to a different contact of the company is skipped and reported (`skipped_duplicate`), so one
   * duplicate never fails the whole import.
   */
  async upsertBatch(contacts: Partial<LeadContact>[]) {
    const results: any[] = [];
    for (const c of contacts) {
      if (c.lead_id && c.external_row_id) {
        let existing = await this.repo.findOne({
          where: { lead_id: c.lead_id, external_row_id: c.external_row_id, company_id: c.company_id },
        });
        if (existing) {
          Object.assign(existing, c);
          results.push(await this.repo.save(existing));
          continue;
        }
      }
      const created = this.repo.create(c);
      try {
        results.push(await this.repo.save(created));
      } catch (e: any) {
        if (!isDuplicatePhone(e)) throw e;
        results.push({ ...c, skipped_duplicate: true });
      }
    }
    return results;
  }
}

function isDuplicatePhone(e: any): boolean {
  const code = e?.code ?? e?.driverError?.code;
  return code === 'ER_DUP_ENTRY' && /phone_key/i.test(String(e?.sqlMessage ?? e?.driverError?.sqlMessage ?? e?.message));
}

function rethrowDuplicatePhone(e: any): never {
  if (isDuplicatePhone(e)) throw new ConflictException('A lead with this phone number already exists in this company');
  throw e;
}
