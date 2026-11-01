import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { User, UserStatus } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { assertPhoneFree, LIVE_STATUSES, phoneFields, rethrowPhoneConflict } from '../../common/phone/user-phone';
import { toCanonicalPhone } from '../../common/phone/phone';
import { assertAcceptablePassword } from '../../common/auth/password-policy';

@Injectable()
export class AuthService {
  // Verified when no account matches, so response time does not reveal which identifiers exist.
  private dummyHash?: Promise<string>;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const password_hash = await argon2.hash(dto.password);
    const phone = dto.phone ? phoneFields(dto.phone) : {};
    if ((phone as any).phone_key) await assertPhoneFree(this.usersRepo, (phone as any).phone_key);
    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email,
      password_hash,
      ...phone,
      status: UserStatus.ACTIVE,
    });
    const saved = await this.usersRepo.save(user).catch(rethrowPhoneConflict);
    return this.generateTokens(saved);
  }

  async login(dto: LoginDto) {
    const user = await this.findForLogin(dto);
    this.dummyHash ??= argon2.hash('not-a-real-password');
    const valid = await argon2.verify(user ? user.password_hash : await this.dummyHash, dto.password).catch(() => false);
    if (!user || !valid) throw new UnauthorizedException('Invalid credentials');
    // Only someone who knows the password learns that the account is blocked.
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }
    return { ...(await this.generateTokens(user)), must_change_password: !!user.must_change_password };
  }

  /** By phone (canonical form, so any common way of typing it works) or by email; both must agree. */
  private async findForLogin(dto: LoginDto): Promise<User | null> {
    let byPhone: User | null | undefined;
    let byEmail: User | null | undefined;
    if (dto.phone !== undefined) {
      const key = toCanonicalPhone(dto.phone);
      byPhone = key ? await this.usersRepo.findOne({ where: { phone_key: key, status: In(LIVE_STATUSES) } }) : null;
      // A blocked account must still be reported as "blocked" to its owner, so fall back to any status.
      byPhone ??= key ? await this.usersRepo.findOne({ where: { phone_key: key } }) : null;
    }
    if (dto.email !== undefined) {
      byEmail = await this.usersRepo.findOne({ where: { email: dto.email.trim() } });
    }
    if (byPhone !== undefined && byEmail !== undefined) return byPhone && byEmail && byPhone.id === byEmail.id ? byPhone : null;
    return (byPhone ?? byEmail) || null;
  }

  async generateTokens(user: User) {
    // Identity only: company/role are resolved from the database per request (JwtStrategy).
    const payload = { sub: user.id, email: user.email, tv: user.token_version ?? 0 };
    const access_token = this.jwtService.sign(payload);
    return { access_token, user: this.sanitizeUser(user) };
  }

  async validateUser(userId: string) {
    return this.usersRepo.findOne({ where: { id: userId } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const valid = await argon2.verify(user.password_hash, currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (currentPassword === newPassword) throw new BadRequestException('The new password must differ from the current one');
    assertAcceptablePassword(newPassword, user);
    user.password_hash = await argon2.hash(newPassword);
    user.must_change_password = false;
    await this.usersRepo.save(user);
    // Every token issued before the change stops working; the caller gets a fresh one.
    await this.usersRepo.increment({ id: userId }, 'token_version', 1);
    const fresh = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    const { access_token } = await this.generateTokens(fresh);
    return { message: 'Password changed successfully', access_token };
  }

  /** Ends every session of the account on the server (all tokens carry the old version). */
  async logout(userId: string) {
    await this.usersRepo.increment({ id: userId }, 'token_version', 1);
  }

  private sanitizeUser(user: User) {
    const { password_hash, token_version, active_phone_key, phone_key, ...rest } = user as any;
    return rest;
  }
}
