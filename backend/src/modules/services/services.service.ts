import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../../domain/core/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const code = (e: any) => e?.code ?? e?.driverError?.code;
const taken = (name: string) => new ConflictException({ message: `الخدمة "${name}" موجودة بالفعل`, code: 'SERVICE_NAME_TAKEN' });

/** The company's list of services (treatments): names that leads and bookings point at. Switched off, rarely deleted. */
@Injectable()
export class ServicesService {
  constructor(@InjectRepository(Service) private readonly repo: Repository<Service>) {}

  async create(companyId: string, dto: CreateServiceDto) {
    try {
      return await this.repo.save(this.repo.create({ company_id: companyId, name: dto.name, active: dto.active ?? true }));
    } catch (e) {
      if (code(e) === 'ER_DUP_ENTRY') throw taken(dto.name);
      throw e;
    }
  }

  /** Sorted by name the way Arabic readers expect. `companyId` undefined = platform admin looking at all. */
  async findAll(companyId?: string) {
    const rows = await this.repo.find({ where: companyId ? { company_id: companyId } : {} });
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ar') || a.id - b.id);
  }

  async findOne(id: number, companyId?: string) {
    const service = await this.repo.findOne({ where: companyId ? { id, company_id: companyId } : { id } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  async update(id: number, dto: UpdateServiceDto, companyId?: string) {
    const current = await this.findOne(id, companyId);
    const changes: Partial<Service> = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.active !== undefined) changes.active = dto.active;
    if (Object.keys(changes).length) {
      try {
        await this.repo.update({ id, company_id: current.company_id }, changes);
      } catch (e) {
        if (code(e) === 'ER_DUP_ENTRY') throw taken(dto.name ?? current.name);
        throw e;
      }
    }
    return this.findOne(id, companyId);
  }

  async remove(id: number, companyId?: string) {
    const current = await this.findOne(id, companyId);
    try {
      await this.repo.delete({ id, company_id: current.company_id });
    } catch (e) {
      if (code(e) === 'ER_ROW_IS_REFERENCED_2') {
        throw new ConflictException({ message: 'الخدمة دي مستخدمة في ليدز أو حجوزات، عطّلها بدل ما تمسحها', code: 'SERVICE_IN_USE' });
      }
      throw e;
    }
    return { message: 'Service deleted' };
  }
}
