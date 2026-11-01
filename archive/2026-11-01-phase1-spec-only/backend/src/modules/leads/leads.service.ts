import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(@InjectRepository(Lead) private readonly repo: Repository<Lead>) {}

  async create(dto: CreateLeadDto) {
    const lead = this.repo.create(dto);
    return this.repo.save(lead);
  }

  /** `companyId` undefined means unrestricted and is only ever passed for platform admins (see tenantScope). */
  async findAll(companyId?: string) {
    const where = companyId ? { company_id: companyId } : {};
    return this.repo.find({ where, order: { created_at: 'DESC' } });
  }

  async findOne(id: string, companyId?: string) {
    const lead = await this.repo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
      relations: ['lead_items', 'lead_contacts'],
    });
    if (!lead) throw new NotFoundException(`Lead source ${id} not found`);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, companyId?: string) {
    await this.findOne(id, companyId);
    const { company_id: _ignored, ...changes } = dto as any; // a row never moves between tenants
    await this.repo.update(id, changes);
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId?: string) {
    await this.findOne(id, companyId);
    await this.repo.delete(id);
    return { message: 'Lead source deleted successfully' };
  }
}
