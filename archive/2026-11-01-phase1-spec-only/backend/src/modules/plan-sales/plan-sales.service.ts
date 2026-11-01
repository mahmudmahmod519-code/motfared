import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanSales } from './entities/plan-sales.entity';
import { CreatePlanSalesDto } from './dto/create-plan-sales.dto';
import { UpdatePlanSalesDto } from './dto/update-plan-sales.dto';

@Injectable()
export class PlanSalesService {
  constructor(
    @InjectRepository(PlanSales)
    private readonly repo: Repository<PlanSales>,
  ) {}

  async create(dto: CreatePlanSalesDto) {
    const plan = this.repo.create(dto);
    return this.repo.save(plan);
  }

  async findAll(companyId?: string) {
    const where = companyId ? { company_id: companyId } : {};
    return this.repo.find({
      where,
      relations: ['creator', 'lead_items', 'lead_items.lead', 'lead_items.lead_item_call_centers', 'lead_items.lead_item_call_centers.user'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, companyId?: string) {
    const plan = await this.repo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
      relations: [
        'creator',
        'lead_items',
        'lead_items.lead',
        'lead_items.lead_item_call_centers',
        'lead_items.lead_item_call_centers.user',
      ],
    });
    if (!plan) throw new NotFoundException(`Plan sales ${id} not found`);
    return plan;
  }

  async update(id: string, dto: UpdatePlanSalesDto, companyId?: string) {
    await this.findOne(id, companyId);
    const { company_id: _c, created_by: _b, ...changes } = dto as any;
    await this.repo.update(id, changes);
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    await this.repo.delete(id);
    return { message: 'Plan sales deleted successfully' };
  }
}
