import { Injectable, ExecutionContext, ForbiddenException, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly reflector: Reflector;

  constructor(@Optional() reflector?: Reflector) {
    super();
    this.reflector = reflector ?? new Reflector();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext, status?: any) {
    const authenticated = super.handleRequest(err, user, info, context, status);
    if (authenticated?.must_change_password) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException({
          message: 'You must set a new password before continuing',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
    }
    return authenticated;
  }
}
