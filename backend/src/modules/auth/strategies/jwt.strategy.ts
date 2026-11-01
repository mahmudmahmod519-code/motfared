import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { resolveJwtSecret } from '../../../common/config/jwt-secret';
import { PLATFORM_ADMIN, TenantPrincipal } from '../../../common/tenant/tenant-scope';
import { User, UserStatus } from '../../users/entities/user.entity';
import { RbacService } from '../../rbac/rbac.service';
import { CompanyMembership, MembershipStatus } from '../../company-memberships/entities/company-membership.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CompanyMembership) private readonly memberships: Repository<CompanyMembership>,
    private readonly rbac: RbacService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Cookie first (web)
        (req: Request) => {
          return req?.cookies?.access_token || null;
        },
        // Then Authorization header (mobile)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config.get<string>('JWT_SECRET')),
    });
  }

  /**
   * The token only proves identity (`sub`). Company, platform role and membership role
   * are re-read from the database on every request, so suspending a user or changing
   * their role takes effect immediately and nothing authorisation-related is taken
   * from the token or the client.
   */
  async validate(payload: any): Promise<TenantPrincipal> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Logout and password changes bump the user's token_version, which kills every older token.
    if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    let role: string | undefined;
    let membership: CompanyMembership | null = null;
    if (user.company_id) {
      membership = await this.memberships.findOne({
        where: { user_id: user.id, company_id: user.company_id, status: MembershipStatus.ACTIVE },
      });
      role = membership?.role;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      // No active membership => no company access (suspended/removed members lose tenant data at once).
      company_id: role ? user.company_id : null,
      role: role ?? null,
      // Resolved from the database like the role itself: never taken from the token or the client.
      permissions: role ? await this.rbac.permissionsFor(user.company_id, role) : [],
      platform_role: user.platform_role === PLATFORM_ADMIN ? PLATFORM_ADMIN : null,
      team_id: role ? (membership?.team_id ?? null) : null,
      must_change_password: !!user.must_change_password,
    };
  }
}
