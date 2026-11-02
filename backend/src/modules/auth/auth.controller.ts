import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, Tenant } from '../../common/decorators/current-user.decorator';
import { TenantPrincipal } from '../../common/tenant/tenant-scope';
import { Throttle } from '@nestjs/throttler';
import { AllowPasswordChange } from '../../common/decorators/allow-password-change.decorator';
import { EntitlementService } from '../subscriptions/entitlement.service';
import { CompanyProfileService } from '../companies/company-profile.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private entitlements: EntitlementService,
    private profiles: CompanyProfileService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @AllowPasswordChange()
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser('id') userId: string, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);
    res.clearCookie('access_token');
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @AllowPasswordChange()
  @UseGuards(JwtAuthGuard)
  async me(@Tenant() user: TenantPrincipal) {
    // Additive field: lets web/mobile refresh the subscription state together with the profile.
    const entitlement = user.company_id ? await this.entitlements.resolve(user.company_id, user.role) : null;
    // Also additive: the company's name, logo, industry words and optional features, so every screen can speak
    // the company's language without a second request.
    const company = user.company_id ? await this.profiles.profile(user.company_id) : null;
    return { ...user, entitlement, company };
  }

  @Post('change-password')
  @AllowPasswordChange()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
    this.setAuthCookie(res, result.access_token); // the old session was revoked; keep this one signed in
    return result;
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }
}
