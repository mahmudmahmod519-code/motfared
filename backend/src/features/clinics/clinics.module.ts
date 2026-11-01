import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from '../../domain/core/campaign.entity';
import { Doctor } from '../../domain/core/doctor.entity';
import { Team } from '../../domain/core/team.entity';
import { ClinicsController } from './clinics.controller';
import { DoctorsService } from './doctors.service';
import { TeamsService } from './teams.service';

@Module({
  imports: [TypeOrmModule.forFeature([Team, Doctor, Campaign])],
  controllers: [ClinicsController],
  providers: [TeamsService, DoctorsService],
  exports: [DoctorsService],
})
export class ClinicsModule {}
