import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Tenant } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TenantApi } from '../../common/decorators/tenant-api.decorator';
import { tenantScope, TenantPrincipal } from '../../common/tenant/tenant-scope';
import { CampaignNameDto, CreateDoctorDto, CreateTeamDto, UpdateDoctorDto, UpdateTeamDto } from './dto/clinics.dto';
import { DoctorsService } from './doctors.service';
import { TeamsService } from './teams.service';

/** Teams, doctors (clinics) and their campaigns. Company members only; reads need the dashboard, writes their own permission. */
@Controller()
@TenantApi()
export class ClinicsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly doctors: DoctorsService,
  ) {}

  // ---- teams -----------------------------------------------------------------------------------------------------

  @Get('teams')
  @RequirePermission('dashboard.view')
  listTeams(@Tenant() user: TenantPrincipal) {
    return this.teams.list(tenantScope(user) as string);
  }

  @Post('teams')
  @RequirePermission('settings.manage')
  createTeam(@Body() dto: CreateTeamDto, @Tenant() user: TenantPrincipal) {
    return this.teams.create(tenantScope(user) as string, dto);
  }

  @Patch('teams/:id')
  @RequirePermission('settings.manage')
  updateTeam(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTeamDto, @Tenant() user: TenantPrincipal) {
    return this.teams.update(tenantScope(user) as string, id, dto);
  }

  // ---- doctors ---------------------------------------------------------------------------------------------------

  @Get('doctors')
  @RequirePermission('dashboard.view')
  listDoctors(@Query('active') active: string | undefined, @Tenant() user: TenantPrincipal) {
    return this.doctors.list(user, { active: active === 'true' ? true : active === 'false' ? false : undefined });
  }

  @Get('doctors/suggest-slug')
  @RequirePermission('doctors.manage')
  suggestSlug(@Query('name') name: string) {
    return this.doctors.suggest(name);
  }

  @Get('doctors/:id')
  @RequirePermission('dashboard.view')
  getDoctor(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.doctors.get(user, id);
  }

  @Post('doctors')
  @RequirePermission('doctors.manage')
  createDoctor(@Body() dto: CreateDoctorDto, @Tenant() user: TenantPrincipal) {
    return this.doctors.create(user, dto);
  }

  @Patch('doctors/:id')
  @RequirePermission('doctors.manage')
  updateDoctor(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDoctorDto, @Tenant() user: TenantPrincipal) {
    return this.doctors.update(user, id, dto);
  }

  // ---- campaigns -------------------------------------------------------------------------------------------------

  @Get('doctors/:id/campaigns')
  @RequirePermission('dashboard.view')
  listCampaigns(@Param('id', ParseIntPipe) id: number, @Tenant() user: TenantPrincipal) {
    return this.doctors.listCampaigns(user, id);
  }

  @Post('doctors/:id/campaigns')
  @RequirePermission('doctors.manage')
  createCampaign(@Param('id', ParseIntPipe) id: number, @Body() dto: CampaignNameDto, @Tenant() user: TenantPrincipal) {
    return this.doctors.createCampaign(user, id, dto);
  }

  @Patch('campaigns/:id')
  @RequirePermission('doctors.manage')
  renameCampaign(@Param('id', ParseIntPipe) id: number, @Body() dto: CampaignNameDto, @Tenant() user: TenantPrincipal) {
    return this.doctors.renameCampaign(user, id, dto);
  }
}
