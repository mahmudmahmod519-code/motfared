import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly repo: Repository<Plan>,
  ) {}

  async create(dto: CreatePlanDto) {
    const plan = this.repo.create(dto);
    return this.repo.save(plan);
  }

  async findAll() {
    return this.repo.find({
      relations: ['plan_prices'],
      order: { created_at: 'ASC' },
    });
  }

  async findOne(id: string) {
    const plan = await this.repo.findOne({
      where: { id },
      relations: ['plan_prices'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Plan deleted' };
  }
}
