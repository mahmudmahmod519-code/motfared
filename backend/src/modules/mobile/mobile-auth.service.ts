import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMembership, MembershipStatus } from '../company-memberships/entities/company-membership.entity';
import { AuthService } from '../auth/auth.service';
import { EntitlementService } from '../subscriptions/entitlement.service';
import { toCanonicalPhone } from '../../common/phone/phone';
import { LIVE_STATUSES } from '../../common/phone/user-phone';

/**
 * Mobile sign-in, keeping the contract the Android app already speaks (`{token, user:{name}}`)
 * and adding the company and the entitlement the SaaS rules need.
 */
@Injectable()
export class MobileAuthService {
  // Verified when the phone is unknown, so response time does not reveal which numbers have accounts.
  private dummyHash?: Promise<string>;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(CompanyMembership) private readonly memberships: Repository<CompanyMembership>,
    private readonly auth: AuthService,
    private readonly entitlements: EntitlementService,
  ) {}

  async login(phone: string, password: string) {
    const key = toCanonicalPhone(phone);
    const user = key ? await this.users.findOne({ where: { phone_key: key, status: In(LIVE_STATUSES) } }) : null;
    this.dummyHash ??= argon2.hash('not-a-real-password');
    const matches = await argon2.verify(user ? user.password_hash : await this.dummyHash, password).catch(() => false);
    if (!user || !matches) throw new UnauthorizedException('Invalid phone or password');

    const membership = user.company_id
      ? await this.memberships.findOne({ where: { user_id: user.id, company_id: user.company_id, status: MembershipStatus.ACTIVE } })
      : null;
    if (!user.company_id || !membership) {
      throw new ForbiddenException({ message: 'This account is not assigned to a company', code: 'NO_COMPANY' });
    }
    const company = await this.companies.findOneOrFail({ where: { id: user.company_id } });

    const { access_token } = await this.auth.generateTokens(user);
    return {
      token: access_token,
      user: { id: user.id, name: user.name, phone: user.phone, role: membership.role },
      company: {
        id: company.id,
        name: company.name,
        client_label: company.client_label,
        call_center_label: company.call_center_label,
        crm_manager_label: company.crm_manager_label,
        phone_whatsapp: company.phone_whatsapp,
        phone_telephone: company.phone_telephone,
      },
      must_change_password: !!user.must_change_password,
      // Login stays possible in every state so the app can explain a restriction (D6).
      entitlement: await this.entitlements.resolve(company.id, membership.role),
    };
  }

  async logout(userId: string) {
    await this.auth.logout(userId);
    return { ok: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const result = await this.auth.changePassword(userId, currentPassword, newPassword);
    return { ok: true, token: result.access_token };
  }
}
