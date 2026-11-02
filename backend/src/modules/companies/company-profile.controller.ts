import { Body, Controller, Get, NotFoundException, Patch } from '@nestjs/common';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { tenantScope, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { CompanyProfileService } from './company-profile.service';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { industryList } from './industry/industries';

/**
 * The caller's own company as the dashboard presents it: name, logo, industry words and optional features.
 * Never takes a company id: a member reads and changes only their own company. Platform admins have none.
 */
@Controller('company-profile')
@TenantApi()
export class CompanyProfileController {
  constructor(private readonly profiles: CompanyProfileService) {}

  private companyOf(user: TenantPrincipal): string {
    const id = tenantScope(user);
    if (!id) throw new NotFoundException('الحساب ده مش تابع لشركة');
    return id;
  }

  @Get()
  get(@Tenant() user: TenantPrincipal) {
    return this.profiles.details(this.companyOf(user));
  }

  @Patch()
  @RequirePermission('settings.manage')
  update(@Body() dto: UpdateCompanyProfileDto, @Tenant() user: TenantPrincipal) {
    return this.profiles.update(this.companyOf(user), dto);
  }
}

/** The industry templates, for the sign-up and settings screens. Public: it holds no company data. */
@Controller('industries')
export class IndustriesController {
  @Get()
  list() {
    return industryList();
  }
}
