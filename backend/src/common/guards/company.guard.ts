import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { isPlatformAdmin } from '../tenant/tenant-scope';

@Injectable()
export class CompanyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // Platform admins bypass company check
    if (isPlatformAdmin(user)) {
      return true;
    }

    // Extract company_id from route params
    const paramCompanyId = request.params?.company_id || request.params?.companyId;

    if (paramCompanyId && user.company_id && paramCompanyId !== user.company_id) {
      throw new ForbiddenException('You do not have access to this company');
    }

    return true;
  }
}
