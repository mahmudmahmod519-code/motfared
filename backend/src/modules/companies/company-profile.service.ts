import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { applyFeatureChanges, applyTermChanges, effectiveProfile, PRESETS } from './industry/industries';

/** How the dashboard presents a company: its name and logo, and the words and features of its industry. */
export interface CompanyProfile {
  id: string;
  name: string;
  logo_url: string | null;
  industry: string;
  industry_label: string;
  terms: Record<string, string>;
  features: Record<string, boolean>;
}

@Injectable()
export class CompanyProfileService {
  constructor(@InjectRepository(Company) private readonly repo: Repository<Company>) {}

  private view(c: Company): CompanyProfile {
    const p = effectiveProfile(c.industry, c.terms, c.features);
    return { id: c.id, name: c.name, logo_url: c.logo_url ?? null, industry: p.industry, industry_label: PRESETS[p.industry].label, terms: p.terms, features: p.features };
  }

  /** The profile as every member sees it (null when the company does not exist). */
  async profile(companyId: string): Promise<CompanyProfile | null> {
    const c = await this.repo.findOne({ where: { id: companyId } });
    return c ? this.view(c) : null;
  }

  /** The profile plus the owner's own overrides, so a settings screen can show what differs from the template. */
  async details(companyId: string) {
    const c = await this.repo.findOne({ where: { id: companyId } });
    if (!c) throw new NotFoundException('الشركة دي مش موجودة');
    return { ...this.view(c), overrides: { terms: c.terms ?? {}, features: c.features ?? {} } };
  }

  async update(companyId: string, dto: UpdateCompanyProfileDto) {
    const c = await this.repo.findOne({ where: { id: companyId } });
    if (!c) throw new NotFoundException('الشركة دي مش موجودة');
    const changes: Partial<Company> = {};
    if (dto.name !== undefined) changes.name = dto.name;
    if (dto.logo_url !== undefined) changes.logo_url = dto.logo_url;
    // A new industry changes the template underneath; the owner's own words and switches stay theirs.
    if (dto.industry !== undefined) changes.industry = dto.industry;
    if (dto.terms !== undefined) {
      const r = applyTermChanges(c.terms, dto.terms);
      if ('message' in r) throw new BadRequestException({ message: r.message, code: 'INVALID_TERMS' });
      changes.terms = r.value;
    }
    if (dto.features !== undefined) {
      const r = applyFeatureChanges(c.features, dto.features);
      if ('message' in r) throw new BadRequestException({ message: r.message, code: 'INVALID_FEATURES' });
      changes.features = r.value;
    }
    if (Object.keys(changes).length) await this.repo.update({ id: companyId }, changes as any);
    return this.details(companyId);
  }
}
