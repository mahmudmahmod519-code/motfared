import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

/** Fields a company CEO may edit; everything else (status, owner, type) is platform-admin only. */
const TENANT_EDITABLE = [
  'name', 'description', 'address', 'phone_whatsapp', 'phone_telephone', 'social_links',
  'client_label', 'call_center_label', 'crm_manager_label',
];

@Injectable()
export class CompaniesService {
  constructor(@InjectRepository(Company) private repo: Repository<Company>) {}

  create(dto: CreateCompanyDto) {
    const company = this.repo.create(dto);
    return this.repo.save(company);
  }

  /** `companyId` undefined = platform admin (all companies). */
  findAll(companyId?: string) {
    return companyId ? this.repo.find({ where: { id: companyId } }) : this.repo.find();
  }

  async findOne(id: string, companyId?: string) {
    if (companyId && id !== companyId) throw new NotFoundException(`Company ${id} not found`);
    const company = await this.repo.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return company;
  }

  async update(id: string, dto: UpdateCompanyDto, companyId?: string) {
    await this.findOne(id, companyId);
    if (companyId) {
      const forbidden = Object.keys(dto).filter((k) => (dto as any)[k] !== undefined && !TENANT_EDITABLE.includes(k));
      if (forbidden.length) {
        throw new ForbiddenException(`Only a platform admin can change: ${forbidden.join(', ')}`);
      }
    }
    await this.repo.update(id, dto);
    return this.findOne(id, companyId);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Company deleted' };
  }
}
