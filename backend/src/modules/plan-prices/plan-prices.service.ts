import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanPrice } from './entities/plan-price.entity';
import { CreatePlanPriceDto } from './dto/create-plan-price.dto';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';

@Injectable()
export class PlanPricesService {
  constructor(
    @InjectRepository(PlanPrice)
    private readonly repo: Repository<PlanPrice>,
  ) {}

  async create(dto: CreatePlanPriceDto) {
    const price = this.repo.create(dto);
    return this.repo.save(price);
  }

  async findAll(planId?: string) {
    const where = planId ? { plan_id: planId } : {};
    return this.repo.find({ where, relations: ['plan'], order: { created_at: 'ASC' } });
  }

  async findOne(id: string) {
    const price = await this.repo.findOne({ where: { id }, relations: ['plan'] });
    if (!price) throw new NotFoundException(`Plan price ${id} not found`);
    return price;
  }

  async update(id: string, dto: UpdatePlanPriceDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Plan price deleted' };
  }
}
