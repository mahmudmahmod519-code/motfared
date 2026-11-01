import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadItem } from './entities/lead-item.entity';
import { CreateLeadItemDto } from './dto/create-lead-item.dto';
import { UpdateLeadItemDto } from './dto/update-lead-item.dto';
import { PlanSales } from '../plan-sales/entities/plan-sales.entity';
import { TenantService } from '../../common/tenant/tenant.service';

@Injectable()
export class LeadItemsService {
  constructor(
    @InjectRepository(LeadItem)
    private readonly repo: Repository<LeadItem>,
    private readonly tenant: TenantService,
  ) {}

  /** `companyId` is the company that owns the plan; the lead must belong to the same company. */
  async create(dto: CreateLeadItemDto, companyId: string) {
    await this.tenant.assertOwned('plan_sales', dto.plan_sales_id, companyId);
    await this.tenant.assertOwned('lead', dto.lead_id, companyId);
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  /** Platform admin: the company is the one that owns the referenced plan. */
  async createAsAdmin(dto: CreateLeadItemDto) {
    const plan = await this.repo.manager.getRepository(PlanSales).findOne({ where: { id: dto.plan_sales_id } });
    if (!plan) throw new NotFoundException(`plan sales ${dto.plan_sales_id} not found`);
    return this.create(dto, plan.company_id);
  }

  async findAll(planSalesId?: string, companyId?: string) {
    const where: any = {};
    if (planSalesId) where.plan_sales_id = planSalesId;
    if (companyId) where.plan_sales = { company_id: companyId };
    return this.repo.find({
      where,
      relations: ['lead', 'plan_sales', 'lead_item_call_centers', 'lead_item_call_centers.user'],
    });
  }

  async findOne(id: string, companyId?: string) {
    const item = await this.repo.findOne({
      where: companyId ? ({ id, plan_sales: { company_id: companyId } } as any) : { id },
      relations: ['lead', 'plan_sales', 'lead_item_call_centers', 'lead_item_call_centers.user'],
    });
    if (!item) throw new NotFoundException(`Lead item ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdateLeadItemDto, companyId?: string) {
    await this.findOne(id, companyId);
    const { plan_sales_id: _p, lead_id: _l, ...changes } = dto as any; // links are immutable
    await this.repo.update(id, changes);
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    await this.repo.delete(id);
    return { message: 'Lead item deleted' };
  }
}
