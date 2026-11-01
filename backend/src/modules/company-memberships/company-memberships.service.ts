import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyMembership } from './entities/company-membership.entity';
import { CreateCompanyMembershipDto } from './dto/create-company-membership.dto';
import { UpdateCompanyMembershipDto } from './dto/update-company-membership.dto';
import { TenantService } from '../../common/tenant/tenant.service';
import { RbacService } from '../rbac/rbac.service';
import { TenantPrincipal } from '../../common/tenant/tenant-scope';

@Injectable()
export class CompanyMembershipsService {
  constructor(
    @InjectRepository(CompanyMembership) private repo: Repository<CompanyMembership>,
    private readonly tenant: TenantService,
    private readonly rbac: RbacService,
  ) {}

  /** `dto.company_id` must already be stamped from the verified principal; `scope` is set for non-admins. */
  async create(dto: CreateCompanyMembershipDto, scope: string | undefined, actor: TenantPrincipal) {
    await this.rbac.assertCanAssign(actor, dto.company_id, dto.role);
    await this.tenant.assertOwned('user', dto.user_id, dto.company_id); // user must already belong to the company
    const m = this.repo.create(dto);
    return this.repo.save(m);
  }

  findAll(companyId?: string) {
    if (companyId) return this.repo.find({ where: { company_id: companyId }, relations: ['user'] });
    return this.repo.find({ relations: ['user'] });
  }

  async findOne(id: string, companyId?: string) {
    const m = await this.repo.findOne({
      where: companyId ? { id, company_id: companyId } : { id },
      relations: ['user', 'company'],
    });
    if (!m) throw new NotFoundException(`Membership ${id} not found`);
    return m;
  }

  async update(id: string, dto: UpdateCompanyMembershipDto, companyId: string | undefined, actor: TenantPrincipal) {
    const existing = await this.findOne(id, companyId);
    // Both the role the member has now and the one they would get must be within the actor's reach.
    await this.rbac.assertCanAssign(actor, existing.company_id, existing.role, { mustExist: false });
    if (dto.role !== undefined) await this.rbac.assertCanAssign(actor, existing.company_id, dto.role);
    const { company_id: _c, user_id: _u, ...changes } = dto as any;
    await this.repo.update(id, changes);
    return this.findOne(id, companyId);
  }

  async remove(id: string, companyId: string | undefined, actor: TenantPrincipal) {
    const existing = await this.findOne(id, companyId);
    await this.rbac.assertCanAssign(actor, existing.company_id, existing.role, { mustExist: false });
    await this.repo.delete(id);
    return { message: 'Membership deleted' };
  }
}
