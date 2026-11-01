import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from '../../domain/core/campaign.entity';
import { Doctor } from '../../domain/core/doctor.entity';
import { Team } from '../../domain/core/team.entity';
import { normaliseSlug, slugError, suggestSlug } from '../../common/slug/public-slug';
import { hasPermission, TenantPrincipal, tenantScope } from '../../common/tenant/tenant-scope';
import { CampaignNameDto, CreateDoctorDto, UpdateDoctorDto } from './dto/clinics.dto';

const isDuplicate = (e: any) => (e?.code ?? e?.driverError?.code) === 'ER_DUP_ENTRY';

/** Which doctors a caller may touch: everything in their company, or (without scope.all_teams) only their team's. */
interface Scope {
  companyId: string;
  all: boolean;
  teamId: number | null;
}

const FIELDS = ['name', 'city', 'phone', 'whatsapp', 'address', 'maps_url', 'hours', 'facebook_url', 'instagram_url', 'notes', 'active'] as const;

@Injectable()
export class DoctorsService {
  constructor(
    @InjectRepository(Doctor) private readonly doctors: Repository<Doctor>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
  ) {}

  private scope(user: TenantPrincipal): Scope {
    return { companyId: tenantScope(user) as string, all: hasPermission(user, 'scope.all_teams'), teamId: user.team_id ?? null };
  }

  private async findInScope(user: TenantPrincipal, id: number): Promise<Doctor> {
    const s = this.scope(user);
    if (!s.all && s.teamId === null) throw new NotFoundException(`Doctor ${id} not found`);
    const doctor = await this.doctors.findOne({ where: { id, company_id: s.companyId, ...(s.all ? {} : { team_id: s.teamId as number }) } });
    if (!doctor) throw new NotFoundException(`Doctor ${id} not found`);
    return doctor;
  }

  private async requireTeam(companyId: string, teamId: number): Promise<Team> {
    const team = await this.teams.findOne({ where: { id: teamId, company_id: companyId } });
    if (!team) throw new BadRequestException({ message: 'الفريق ده مش موجود', code: 'TEAM_NOT_FOUND' });
    return team;
  }

  private async view(d: Doctor, extra: { team?: Team | null; campaigns_count?: number; campaigns?: ReturnType<DoctorsService['campaignView']>[] } = {}) {
    const team = extra.team !== undefined ? extra.team : d.team_id ? await this.teams.findOne({ where: { id: d.team_id, company_id: d.company_id } }) : null;
    return {
      id: d.id, company_id: d.company_id, name: d.name, team_id: d.team_id, team: team ? { id: team.id, code: team.code, name: team.name } : null,
      city: d.city, phone: d.phone, whatsapp: d.whatsapp, address: d.address, maps_url: d.maps_url, hours: d.hours,
      facebook_url: d.facebook_url, instagram_url: d.instagram_url, notes: d.notes, active: d.active, slug: d.slug, created_at: d.created_at,
      ...(extra.campaigns_count !== undefined && { campaigns_count: extra.campaigns_count }),
      ...(extra.campaigns && { campaigns: extra.campaigns }),
    };
  }

  private campaignView(c: Campaign) {
    return { id: c.id, company_id: c.company_id, doctor_id: c.doctor_id, name: c.name, created_at: c.created_at };
  }

  async list(user: TenantPrincipal, opts: { active?: boolean } = {}) {
    const s = this.scope(user);
    if (!s.all && s.teamId === null) return [];
    const qb = this.doctors.createQueryBuilder('d').where('d.company_id = :c', { c: s.companyId });
    if (!s.all) qb.andWhere('d.team_id = :t', { t: s.teamId });
    if (opts.active !== undefined) qb.andWhere('d.active = :a', { a: opts.active });
    const rows = await qb.orderBy('d.name', 'ASC').addOrderBy('d.id', 'ASC').getMany();
    const [teams, counts] = await Promise.all([
      this.teams.find({ where: { company_id: s.companyId } }),
      this.campaigns
        .createQueryBuilder('c')
        .select('c.doctor_id', 'doctor_id')
        .addSelect('COUNT(*)', 'n')
        .where('c.company_id = :c', { c: s.companyId })
        .groupBy('c.doctor_id')
        .getRawMany<{ doctor_id: string; n: string }>(),
    ]);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const countBy = new Map(counts.map((r) => [Number(r.doctor_id), Number(r.n)]));
    return Promise.all(rows.map((d) => this.view(d, { team: d.team_id ? teamById.get(d.team_id) ?? null : null, campaigns_count: countBy.get(d.id) ?? 0 })));
  }

  async get(user: TenantPrincipal, id: number) {
    const d = await this.findInScope(user, id);
    const campaigns = await this.campaigns.find({ where: { company_id: d.company_id, doctor_id: d.id }, order: { id: 'ASC' } });
    return this.view(d, { campaigns: campaigns.map((c) => this.campaignView(c)), campaigns_count: campaigns.length });
  }

  /** The team a new or moved doctor ends up in, enforcing the caller's own scope. */
  private async resolveTeam(user: TenantPrincipal, requested: number | null | undefined, current: number | null): Promise<number | null> {
    const s = this.scope(user);
    if (!s.all) {
      if (s.teamId === null) throw new ForbiddenException({ message: 'مفيش فريق متسجّل لحسابك', code: 'NO_TEAM' });
      if (requested !== undefined && requested !== null && requested !== s.teamId) {
        throw new ForbiddenException({ message: 'تقدر تدير عيادات فريقك بس', code: 'OTHER_TEAM' });
      }
      if (requested === null) throw new ForbiddenException({ message: 'تقدر تدير عيادات فريقك بس', code: 'OTHER_TEAM' });
      return s.teamId;
    }
    if (requested === undefined) return current;
    if (requested === null) return null;
    await this.requireTeam(s.companyId, requested);
    return requested;
  }

  private slugChange(raw: string | null | undefined): { set: boolean; value: string | null } {
    if (raw === undefined) return { set: false, value: null };
    if (raw === null || raw.trim() === '') return { set: true, value: null };
    const why = slugError(raw);
    if (why) throw new BadRequestException({ message: why, code: 'SLUG_INVALID' });
    return { set: true, value: normaliseSlug(raw) };
  }

  async create(user: TenantPrincipal, dto: CreateDoctorDto) {
    const companyId = tenantScope(user) as string;
    const team_id = await this.resolveTeam(user, dto.team_id, null);
    const slug = this.slugChange(dto.slug);
    const values: Partial<Doctor> = { company_id: companyId, name: dto.name, team_id, slug: slug.value, active: dto.active ?? true };
    for (const f of FIELDS) if (f !== 'name' && f !== 'active' && dto[f] !== undefined) (values as any)[f] = dto[f];
    try {
      const saved = await this.doctors.save(this.doctors.create(values));
      return this.view(saved);
    } catch (e) {
      throw this.mapSlugClash(e);
    }
  }

  async update(user: TenantPrincipal, id: number, dto: UpdateDoctorDto) {
    const current = await this.findInScope(user, id);
    const changes: Partial<Doctor> = {};
    if (dto.team_id !== undefined) changes.team_id = await this.resolveTeam(user, dto.team_id, current.team_id);
    const slug = this.slugChange(dto.slug);
    if (slug.set) changes.slug = slug.value;
    for (const f of FIELDS) if (dto[f] !== undefined) (changes as any)[f] = dto[f];
    if (Object.keys(changes).length) {
      try {
        await this.doctors.update({ id, company_id: current.company_id }, changes);
      } catch (e) {
        throw this.mapSlugClash(e);
      }
    }
    return this.view(await this.doctors.findOneByOrFail({ id, company_id: current.company_id }));
  }

  private mapSlugClash(e: any) {
    if (isDuplicate(e) && /slug/i.test(String(e?.sqlMessage ?? e?.driverError?.sqlMessage ?? e?.message))) {
      return new ConflictException({ message: 'اللينك ده مستخدم عند عيادة تانية - اختار اسم تاني', code: 'SLUG_TAKEN' });
    }
    return e;
  }

  suggest(name: string) {
    return { slug: suggestSlug(name) };
  }

  // ---- campaigns ---------------------------------------------------------------------------------------------------

  async listCampaigns(user: TenantPrincipal, doctorId: number) {
    const d = await this.findInScope(user, doctorId);
    const rows = await this.campaigns.find({ where: { company_id: d.company_id, doctor_id: d.id }, order: { id: 'ASC' } });
    return rows.map((c) => this.campaignView(c));
  }

  async createCampaign(user: TenantPrincipal, doctorId: number, dto: CampaignNameDto) {
    const d = await this.findInScope(user, doctorId);
    const saved = await this.campaigns.save(this.campaigns.create({ company_id: d.company_id, doctor_id: d.id, name: dto.name }));
    return this.campaignView(saved);
  }

  async renameCampaign(user: TenantPrincipal, campaignId: number, dto: CampaignNameDto) {
    const companyId = tenantScope(user) as string;
    const campaign = await this.campaigns.findOne({ where: { id: campaignId, company_id: companyId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    await this.findInScope(user, campaign.doctor_id); // the doctor must be one the caller may manage
    await this.campaigns.update({ id: campaignId, company_id: companyId }, { name: dto.name });
    return this.campaignView(await this.campaigns.findOneByOrFail({ id: campaignId, company_id: companyId }));
  }
}
