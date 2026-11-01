import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../domain/core/team.entity';
import { CreateTeamDto, UpdateTeamDto } from './dto/clinics.dto';

const isDuplicate = (e: any) => (e?.code ?? e?.driverError?.code) === 'ER_DUP_ENTRY';
const view = (t: Team) => ({ id: t.id, company_id: t.company_id, name: t.name, code: t.code, created_at: t.created_at });

/** Teams (the original's groups A/B/C): a company's own, with a code unique inside it. */
@Injectable()
export class TeamsService {
  constructor(@InjectRepository(Team) private readonly teams: Repository<Team>) {}

  async list(companyId: string) {
    const rows = await this.teams.find({ where: { company_id: companyId }, order: { code: 'ASC' } });
    return rows.map(view);
  }

  async create(companyId: string, dto: CreateTeamDto) {
    try {
      const saved = await this.teams.save(this.teams.create({ company_id: companyId, name: dto.name, code: dto.code }));
      return view(saved);
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException({ message: `الكود "${dto.code}" مستخدم عند فريق تاني`, code: 'TEAM_CODE_TAKEN' });
      throw e;
    }
  }

  async update(companyId: string, id: number, dto: UpdateTeamDto) {
    const team = await this.teams.findOne({ where: { id, company_id: companyId } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    try {
      await this.teams.update({ id, company_id: companyId }, { ...(dto.name !== undefined && { name: dto.name }), ...(dto.code !== undefined && { code: dto.code }) });
    } catch (e) {
      if (isDuplicate(e)) throw new ConflictException({ message: `الكود "${dto.code}" مستخدم عند فريق تاني`, code: 'TEAM_CODE_TAKEN' });
      throw e;
    }
    return view(await this.teams.findOneByOrFail({ id, company_id: companyId }));
  }
}
