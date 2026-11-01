import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadItemCallCenter } from './entities/lead-item-call-center.entity';
import { CreateLeadItemCallCenterDto } from './dto/create-lead-item-call-center.dto';
import { UpdateLeadItemCallCenterDto } from './dto/update-lead-item-call-center.dto';
import { LeadItem } from '../lead-items/entities/lead-item.entity';
import { TenantService } from '../../common/tenant/tenant.service';

@Injectable()
export class LeadItemCallCentersService {
  constructor(
    @InjectRepository(LeadItemCallCenter)
    private readonly repo: Repository<LeadItemCallCenter>,
    private readonly tenant: TenantService,
  ) {}

  async create(dto: CreateLeadItemCallCenterDto, companyId: string) {
    await this.tenant.assertOwned('lead_item', dto.lead_item_id, companyId);
    await this.tenant.assertOwned('user', dto.user_id, companyId);
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  /** Platform admin: the company is the one that owns the referenced lead item's plan. */
  async createAsAdmin(dto: CreateLeadItemCallCenterDto) {
    const item = await this.repo.manager.getRepository(LeadItem).findOne({ where: { id: dto.lead_item_id }, relations: ['plan_sales'] });
    if (!item) throw new NotFoundException(`lead item ${dto.lead_item_id} not found`);
    return this.create(dto, item.plan_sales.company_id);
  }

  async findAll(leadItemId?: string, userId?: string, companyId?: string) {
    const qb = this.repo.createQueryBuilder('licc')
      .leftJoinAndSelect('licc.user', 'user')
      .leftJoinAndSelect('licc.lead_item', 'lead_item')
      .leftJoinAndSelect('lead_item.lead', 'lead')
      .leftJoinAndSelect('lead_item.plan_sales', 'plan_sales')
      .leftJoinAndSelect('licc.calls', 'calls');

    if (companyId) {
      qb.andWhere('plan_sales.company_id = :companyId', { companyId });
    }
    if (leadItemId) {
      qb.andWhere('licc.lead_item_id = :leadItemId', { leadItemId });
    }
    if (userId) {
      qb.andWhere('licc.user_id = :userId', { userId });
    }

    return qb.getMany();
  }

  async findOne(id: string, companyId?: string) {
    const item = await this.repo.findOne({
      where: companyId ? ({ id, lead_item: { plan_sales: { company_id: companyId } } } as any) : { id },
      relations: ['user', 'lead_item', 'lead_item.lead', 'lead_item.plan_sales', 'calls'],
    });
    if (!item) throw new NotFoundException(`Assignment ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateLeadItemCallCenterDto, companyId?: string) {
    const existing = await this.findOne(id, companyId);
    const { lead_item_id: _l, ...changes } = dto as any;
    if (changes.user_id && changes.user_id !== existing.user_id) {
      await this.tenant.assertOwned('user', changes.user_id, existing.lead_item.plan_sales.company_id);
    }
    await this.repo.update(id, changes);
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    await this.repo.delete(id);
    return { message: 'Assignment deleted' };
  }
}
