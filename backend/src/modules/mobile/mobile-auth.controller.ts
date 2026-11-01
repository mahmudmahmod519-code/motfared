import { Body, Controller, HttpCode, Post, UseFilters, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MobileAuthService } from './mobile-auth.service';
import { MobileChangePasswordDto, MobileLoginDto } from './dto/mobile-auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AllowPasswordChange } from '../../common/decorators/allow-password-change.decorator';
import { AllowFields } from '../../common/decorators/allow-fields.decorator';
import { MobileExceptionFilter } from '../../common/filters/mobile-exception.filter';

/**
 * Legacy-compatible paths for the Android app: /api/mobile/login, /logout, /me/password.
 * Deliberately not under @TenantApi(): sign-in, sign-out and password change must work in
 * every subscription state (see the exemption list in guard-coverage.e2e-spec.ts).
 */
@Controller('mobile')
@UseFilters(MobileExceptionFilter)
export class MobileAuthController {
  constructor(private readonly service: MobileAuthService) {}

  @Post('login')
  @HttpCode(200)
  @AllowFields('token') // the app's contract: the session token is part of the login response
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  login(@Body() dto: MobileLoginDto) {
    return this.service.login(dto.phone, dto.password);
  }

  @Post('logout')
  @HttpCode(200)
  @AllowPasswordChange()
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser('id') userId: string) {
    return this.service.logout(userId);
  }

  @Post('me/password')
  @HttpCode(200)
  @AllowFields('token') // a fresh session token replaces the revoked ones
  @AllowPasswordChange()
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser('id') userId: string, @Body() dto: MobileChangePasswordDto) {
    return this.service.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
