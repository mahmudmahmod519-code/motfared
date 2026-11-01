import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CompanyMembership } from '../company-memberships/entities/company-membership.entity';
import { LIVE_STATUSES, assertPhoneFree, phoneFields, rethrowPhoneConflict } from '../../common/phone/user-phone';
import { PLATFORM_ADMIN, TenantPrincipal, hasPermission, isPlatformAdmin, tenantScope } from '../../common/tenant/tenant-scope';
import { RbacService } from '../rbac/rbac.service';

/** Profile fields a user may change on themselves or an account manager may change on a company member. */
const PROFILE_FIELDS = ['name', 'phone', 'address', 'social_links', 'whatsapp_phone'];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(CompanyMembership) private memberships: Repository<CompanyMembership>,
    private readonly rbac: RbacService,
  ) {}

  /**
   * Platform admins create anyone; a company member with accounts.manage creates members of their own
   * company only, never with a platform role, and only with a role they are allowed to hand out
   * (see RbacService.assertCanAssign; default sales).
   */
  async create(dto: CreateUserDto, actor?: TenantPrincipal) {
    const exists = await this.repo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already exists');
    const { password, role, ...rest } = dto as any;

    let company_id: string | undefined = rest.company_id;
    if (actor && !isPlatformAdmin(actor)) {
      if (rest.platform_role) throw new ForbiddenException('platform_role cannot be set');
      if (rest.status && rest.status !== UserStatus.ACTIVE && rest.status !== UserStatus.PENDING) {
        throw new ForbiddenException('status cannot be set');
      }
      company_id = tenantScope(actor);
      await this.rbac.assertCanAssign(actor, company_id as string, role || 'sales');
    } else {
      if (rest.platform_role && rest.platform_role !== PLATFORM_ADMIN) {
        throw new ForbiddenException(`platform_role must be '${PLATFORM_ADMIN}'`);
      }
      if (company_id && role) await this.rbac.assertCanAssign(actor, company_id, role);
    }

    const password_hash = await argon2.hash(password);
    const phone = rest.phone ? phoneFields(rest.phone) : {};
    const status = dto.status || UserStatus.ACTIVE;
    if ((phone as any).phone_key && LIVE_STATUSES.includes(status)) await assertPhoneFree(this.repo, (phone as any).phone_key);
    const user = await this.repo
      .save(this.repo.create({ ...rest, ...phone, company_id, password_hash, status }) as any)
      .catch(rethrowPhoneConflict) as unknown as User;
    if (company_id) {
      await this.memberships.save(this.memberships.create({ company_id, user_id: user.id, role: role || 'sales' }));
    }
    return user;
  }

  /** `companyId` undefined = platform admin. */
  findAll(companyId?: string) {
    if (companyId) {
      return this.repo.find({ where: { company_id: companyId } });
    }
    return this.repo.find();
  }

  async findOne(id: string, companyId?: string) {
    const user = await this.repo.findOne({ where: companyId ? { id, company_id: companyId } : { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  /** Read access: platform admin, the user themselves, or a member of the same company holding accounts.view. */
  async findOneFor(id: string, actor: TenantPrincipal) {
    if (isPlatformAdmin(actor) || actor.id === id) return this.findOne(id);
    if (!hasPermission(actor, 'accounts.view')) throw new NotFoundException(`User ${id} not found`);
    return this.findOne(id, tenantScope(actor));
  }

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto, actor: TenantPrincipal) {
    const { password, role: _role, ...rest } = dto as any;
    let target: User;

    if (isPlatformAdmin(actor)) {
      target = await this.findOne(id);
      if (rest.platform_role && rest.platform_role !== PLATFORM_ADMIN) {
        throw new ForbiddenException(`platform_role must be '${PLATFORM_ADMIN}'`);
      }
    } else {
      const isSelf = actor.id === id;
      const managesAccounts = hasPermission(actor, 'accounts.manage');
      if (!isSelf && !managesAccounts) throw new NotFoundException(`User ${id} not found`);
      target = isSelf ? await this.findOne(id) : await this.findOne(id, tenantScope(actor));
      if (target.platform_role === PLATFORM_ADMIN && !isSelf) throw new NotFoundException(`User ${id} not found`);
      if (!isSelf) {
        // Nobody manages an account whose role sits above what they may hand out.
        const membership = await this.memberships.findOne({ where: { company_id: tenantScope(actor), user_id: id } });
        await this.rbac.assertCanAssign(actor, tenantScope(actor) as string, membership?.role ?? 'sales', { mustExist: false });
      }

      // Role, tenant, status and credentials never change through a generic profile update.
      const forbidden = [...Object.keys(rest), ...(password ? ['password'] : [])].filter(
        (k) => rest[k] !== undefined && !PROFILE_FIELDS.includes(k),
      );
      if (password) forbidden.push('password');
      if (forbidden.length) {
        throw new ForbiddenException(`Not allowed to change: ${[...new Set(forbidden)].join(', ')}`);
      }
    }

    const updates: any = { ...rest };
    if (password) {
      updates.password_hash = await argon2.hash(password);
    }
    if (rest.phone !== undefined) {
      if (rest.phone) {
        Object.assign(updates, phoneFields(rest.phone));
        if (LIVE_STATUSES.includes(target.status)) await assertPhoneFree(this.repo, updates.phone_key, id);
      } else {
        updates.phone = null;
        updates.phone_key = null;
      }
    }
    await this.repo.update(id, updates).catch(rethrowPhoneConflict);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'User deleted' };
  }

  async changeStatus(id: string, status: UserStatus, actor: TenantPrincipal) {
    if (!Object.values(UserStatus).includes(status)) throw new BadRequestException('Invalid status');
    const target = isPlatformAdmin(actor) ? await this.findOne(id) : await this.findOne(id, tenantScope(actor));
    if (!isPlatformAdmin(actor) && (target.platform_role === PLATFORM_ADMIN || target.id === actor.id)) {
      throw new ForbiddenException('Not allowed to change this account status');
    }
    // Re-activating must not create a second active user with the same phone.
    if (LIVE_STATUSES.includes(status) && target.phone_key) await assertPhoneFree(this.repo, target.phone_key, id);
    await this.repo.update(id, { status }).catch(rethrowPhoneConflict);
    return this.findOne(id);
  }
}
