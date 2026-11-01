import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { CompanyMembership } from '../company-memberships/entities/company-membership.entity';
import { OWNER_KEY, PERMISSIONS, PERMISSION_KEYS, SYSTEM_ROLES, SYSTEM_ROLE_KEYS, systemRole } from './permissions.catalogue';
import { RbacService } from './rbac.service';
import { TenantPrincipal } from '../../common/tenant/tenant-scope';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

export interface RoleView {
  key: string;
  name: string;
  description?: string;
  is_system: boolean;
  /** A system role this company changed (stored as an override of the defaults). */
  customized: boolean;
  permissions: string[];
  member_count: number;
}

/** System roles are listed from most to least powerful, then the company's own roles. */
const SYSTEM_ORDER = [...SYSTEM_ROLES].reverse().map((r) => r.key as string);

const ownerLocked = () =>
  new ForbiddenException({ message: 'The owner role always holds every permission and cannot be changed or deleted', code: 'OWNER_ROLE_LOCKED' });

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(CompanyMembership) private readonly memberships: Repository<CompanyMembership>,
    private readonly rbac: RbacService,
    private readonly dataSource: DataSource,
  ) {}

  catalogue() {
    return PERMISSIONS.map((p) => ({ ...p }));
  }

  async list(companyId: string): Promise<RoleView[]> {
    const [rows, counts] = await Promise.all([this.rows(companyId), this.memberCounts(companyId)]);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const system = SYSTEM_ORDER.map((key) => this.view(key, byKey.get(key), counts));
    const custom = rows
      .filter((r) => !SYSTEM_ROLE_KEYS.includes(r.key))
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime() || a.key.localeCompare(b.key))
      .map((r) => this.view(r.key, r, counts));
    return [...system, ...custom];
  }

  async get(companyId: string, key: string): Promise<RoleView> {
    const row = await this.row(companyId, key);
    if (!row && !SYSTEM_ROLE_KEYS.includes(key)) throw new NotFoundException(`Role '${key}' not found`);
    return this.view(key, row ?? undefined, await this.memberCounts(companyId));
  }

  async create(actor: TenantPrincipal, companyId: string, dto: CreateRoleDto): Promise<RoleView> {
    if (SYSTEM_ROLE_KEYS.includes(dto.key)) throw new ConflictException(`'${dto.key}' is a reserved role key`);
    const permissions = this.validPermissions(dto.permissions);
    this.rbac.assertHolds(actor, permissions);
    if (await this.row(companyId, dto.key)) throw new ConflictException(`Role '${dto.key}' already exists`);
    await this.dataSource.transaction(async (em) => {
      const role = await em.getRepository(Role).save({ company_id: companyId, key: dto.key, name: dto.name.trim(), is_system: false } as Role);
      await this.writePermissions(em.getRepository(RolePermission), role.id, permissions);
    }).catch((e) => {
      if ((e?.code ?? e?.driverError?.code) === 'ER_DUP_ENTRY') throw new ConflictException(`Role '${dto.key}' already exists`); // lost a race
      throw e;
    });
    return this.get(companyId, dto.key);
  }

  async update(actor: TenantPrincipal, companyId: string, key: string, dto: UpdateRoleDto): Promise<RoleView> {
    if (key === OWNER_KEY) throw ownerLocked();
    const existing = await this.row(companyId, key);
    const isSystem = SYSTEM_ROLE_KEYS.includes(key);
    if (!existing && !isSystem) throw new NotFoundException(`Role '${key}' not found`);

    const permissions = this.validPermissions(dto.permissions);
    const current = await this.rbac.permissionsFor(companyId, key);
    this.rbac.assertHolds(actor, permissions.filter((p) => !current.includes(p))); // removing is always allowed

    await this.dataSource.transaction(async (em) => {
      const roles = em.getRepository(Role);
      const role =
        existing ??
        (await roles.save({ company_id: companyId, key, name: systemRole(key)!.name, is_system: true } as Role)); // copy-on-write
      if (!isSystem && dto.name !== undefined) await roles.update(role.id, { name: dto.name.trim() });
      await this.writePermissions(em.getRepository(RolePermission), role.id, permissions);
    });
    return this.get(companyId, key);
  }

  /** A custom role is deleted (refused while members hold it); a customised system role is reset to its defaults. */
  async remove(actor: TenantPrincipal, companyId: string, key: string) {
    if (key === OWNER_KEY) throw ownerLocked();
    const existing = await this.row(companyId, key);
    if (SYSTEM_ROLE_KEYS.includes(key)) {
      if (existing) {
        // Resetting can hand permissions back: that is granting, so the same rule applies.
        const current = await this.rbac.permissionsFor(companyId, key);
        this.rbac.assertHolds(actor, systemRole(key)!.permissions.filter((p) => !current.includes(p)));
        await this.roles.delete(existing.id);
      }
      return { message: `Role '${key}' reset to its defaults` };
    }
    if (!existing) throw new NotFoundException(`Role '${key}' not found`);
    const inUse = await this.memberships.count({ where: { company_id: companyId, role: key } });
    if (inUse > 0) {
      throw new ConflictException({ message: `Role '${key}' is held by ${inUse} member(s); give them another role first`, code: 'ROLE_IN_USE', member_count: inUse });
    }
    await this.roles.delete(existing.id);
    return { message: `Role '${key}' deleted` };
  }

  // ---- helpers -------------------------------------------------------------------------------

  private validPermissions(input: string[]): string[] {
    const unique = [...new Set(input)];
    const unknown = unique.filter((p) => !PERMISSION_KEYS.includes(p));
    if (unknown.length) throw new BadRequestException(`Unknown permission(s): ${unknown.join(', ')}`);
    return unique;
  }

  private async writePermissions(repo: Repository<RolePermission>, roleId: string, permissions: string[]) {
    await repo.delete({ role_id: roleId });
    if (permissions.length) await repo.insert(permissions.map((permission_key) => ({ role_id: roleId, permission_key })));
  }

  private row(companyId: string, key: string) {
    return this.roles.findOne({ where: { company_id: companyId, key }, relations: { permissions: true } });
  }

  private rows(companyId: string) {
    return this.roles.find({ where: { company_id: companyId }, relations: { permissions: true } });
  }

  private async memberCounts(companyId: string): Promise<Map<string, number>> {
    const rows: { role: string; n: string }[] = await this.memberships
      .createQueryBuilder('m')
      .select('m.role', 'role')
      .addSelect('COUNT(*)', 'n')
      .where('m.company_id = :companyId', { companyId })
      .groupBy('m.role')
      .getRawMany();
    return new Map(rows.map((r) => [r.role, Number(r.n)]));
  }

  private view(key: string, row: Role | undefined, counts: Map<string, number>): RoleView {
    const system = systemRole(key);
    const permissions = key === OWNER_KEY ? [...PERMISSION_KEYS] : row ? row.permissions.map((p) => p.permission_key) : [...(system?.permissions ?? [])];
    return {
      key,
      name: system?.name ?? row!.name,
      ...(system ? { description: system.description } : {}),
      is_system: !!system,
      customized: !!system && !!row && key !== OWNER_KEY,
      permissions,
      member_count: counts.get(key) ?? 0,
    };
  }
}
