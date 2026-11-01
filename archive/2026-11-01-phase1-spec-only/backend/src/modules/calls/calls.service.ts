import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call, CallOutcome, CustomerDecision } from './entities/call.entity';
import { LeadContact, LeadContactStatus } from '../lead-contacts/entities/lead-contact.entity';
import { CreateCallDto } from './dto/create-call.dto';
import { UpdateCallDto } from './dto/update-call.dto';
import { TenantService } from '../../common/tenant/tenant.service';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call)
    private readonly repo: Repository<Call>,
    @InjectRepository(LeadContact)
    private readonly contactRepo: Repository<LeadContact>,
    private readonly tenant: TenantService,
  ) {}

  /** `dto.company_id` and `dto.call_center_user_id` must already be stamped from the verified principal. */
  async create(dto: CreateCallDto) {
    // The contact and assignment must belong to the call's company; otherwise a tenant could
    // log calls against (and change the status of) another tenant's contacts.
    await this.tenant.assertOwned('lead_contact', dto.lead_contact_id, dto.company_id);
    await this.tenant.assertOwned('assignment', dto.assignment_id, dto.company_id);

    if (!dto.called_at) {
      dto.called_at = new Date().toISOString();
    }
    const call = this.repo.create(dto);
    const saved = await this.repo.save(call);

    // Update contact status based on customer decision or outcome
    const contact = await this.contactRepo.findOne({ where: { id: dto.lead_contact_id, company_id: dto.company_id } });
    if (contact) {
      if (dto.customer_decision === CustomerDecision.ACCEPTED) {
        contact.status = LeadContactStatus.CONVERTED;
      } else if (dto.customer_decision === CustomerDecision.REJECTED) {
        contact.status = LeadContactStatus.REJECTED;
      } else if (dto.outcome === CallOutcome.ANSWERED) {
        contact.status = LeadContactStatus.IN_PROGRESS;
      }
      await this.contactRepo.save(contact);
    }

    return saved;
  }

  async findAll(companyId?: string, userId?: string, contactId?: string) {
    const qb = this.repo.createQueryBuilder('call')
      .leftJoinAndSelect('call.lead_contact', 'contact')
      .leftJoinAndSelect('contact.lead', 'lead')
      .leftJoinAndSelect('call.call_center_user', 'user')
      .leftJoinAndSelect('call.assignment', 'assignment')
      .orderBy('call.called_at', 'DESC');

    if (companyId) {
      qb.andWhere('call.company_id = :companyId', { companyId });
    }
    if (userId) {
      qb.andWhere('call.call_center_user_id = :userId', { userId });
    }
    if (contactId) {
      qb.andWhere('call.lead_contact_id = :contactId', { contactId });
    }

    return qb.getMany();
  }

  /** `onlyUserId` restricts call-center agents to their own calls. */
  async findOne(id: string, companyId?: string, onlyUserId?: string) {
    const call = await this.repo.findOne({
      where: {
        id,
        ...(companyId ? { company_id: companyId } : {}),
        ...(onlyUserId ? { call_center_user_id: onlyUserId } : {}),
      },
      relations: ['lead_contact', 'lead_contact.lead', 'call_center_user', 'assignment'],
    });
    if (!call) throw new NotFoundException(`Call record ${id} not found`);
    return call;
  }

  async update(id: string, dto: UpdateCallDto, companyId?: string, onlyUserId?: string) {
    const existing = await this.findOne(id, companyId, onlyUserId);
    // A call never changes tenant, contact or author.
    const { company_id: _c, lead_contact_id: _l, call_center_user_id: _u, ...changes } = dto as any;
    if (changes.assignment_id) {
      await this.tenant.assertOwned('assignment', changes.assignment_id, existing.company_id);
    }
    await this.repo.update(id, changes);
    return this.findOne(id, companyId, onlyUserId);
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    await this.repo.delete(id);
    return { message: 'Call record deleted' };
  }
}
