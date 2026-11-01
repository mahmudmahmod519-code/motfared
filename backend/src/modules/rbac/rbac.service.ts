import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { OWNER_KEY, PERMISSION_KEYS, SYSTEM_ROLE_KEYS, systemRole } from './permissions.catalogue';
import { TenantPrincipal, hasPermission, isPlatformAdmin } from '../../common/tenant/tenant-scope';

/** The one role an account manager may hand out; every other role needs accounts.admin. */
const ORDINARY_ROLE = 'sales';

/**
 * Resolves what a role may do inside one company. A company-specific role row (an override of a
 * system role, or a custom role) wins; otherwise a system role uses its defaults; an unknown role
 * has nothing. The owner is never reduced, so a company can not lock itself out.
 */
@Injectable()
export class RbacService {
  constructor(@InjectRepository(Role) private readonly roles: Repository<Role>) {}

  async permissionsFor(companyId: string | undefined | null, roleKey: string | undefined | null): Promise<string[]> {
    if (!companyId || !roleKey) return [];
    if (roleKey === OWNER_KEY) return [...PERMISSION_KEYS];
    const row = await this.roles.findOne({ where: { company_id: companyId, key: roleKey }, relations: { permissions: true } });
    if (row) return row.permissions.map((p) => p.permission_key);
    return [...(systemRole(roleKey)?.permissions ?? [])];
  }

  /** A system role, or a role this company defined. */
  async roleExists(companyId: string, roleKey: string): Promise<boolean> {
    if (SYSTEM_ROLE_KEYS.includes(roleKey)) return true;
    return (await this.roles.count({ where: { company_id: companyId, key: roleKey } })) > 0;
  }

  /**
   * May `actor` give someone `roleKey` in `companyId` (or touch a membership that already has it)?
   * Nobody grants what they do not hold: the role's permissions must be a subset of the actor's own;
   * the owner role is never handed out inside a company; the ordinary role needs accounts.manage and
   * every other role accounts.admin. Platform admins are exempt from the last three, not from
   * the existence check.
   */
  async assertCanAssign(actor: TenantPrincipal, companyId: string, roleKey: string, opts: { mustExist?: boolean } = { mustExist: true }) {
    if (opts.mustExist !== false && !(await this.roleExists(companyId, roleKey))) {
      throw new BadRequestException(`Unknown role '${roleKey}'`);
    }
    if (isPlatformAdmin(actor)) return;
    if (roleKey === OWNER_KEY) throw new ForbiddenException(`Only a platform admin can assign or change the '${OWNER_KEY}' role`);

    const need = roleKey === ORDINARY_ROLE ? 'accounts.manage' : 'accounts.admin';
    if (!hasPermission(actor, need)) throw new ForbiddenException({ message: `Missing permission: ${need}`, code: 'PERMISSION_DENIED', permission: need });

    this.assertHolds(actor, await this.permissionsFor(companyId, roleKey));
  }

  /** Nobody grants what they do not hold: every permission in `granted` must be one of the actor's own. */
  assertHolds(actor: TenantPrincipal, granted: string[]) {
    if (isPlatformAdmin(actor)) return;
    const beyond = granted.filter((p) => !hasPermission(actor, p));
    if (beyond.length) {
      throw new ForbiddenException({
        message: `You cannot grant permissions you do not hold: ${beyond.join(', ')}`,
        code: 'PERMISSION_ESCALATION',
        permissions: beyond,
      });
    }
  }
}
