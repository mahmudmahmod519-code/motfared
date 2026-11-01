import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { CompanyMembership } from '../company-memberships/entities/company-membership.entity';
import { LeadContact } from '../lead-contacts/entities/lead-contact.entity';
import { CallResult } from '../call-results/entities/call-result.entity';
import { UserDoctor } from '../doctors/entities/user-doctor.entity';
import { Service } from '../services/entities/service.entity';
import { Lead } from '../leads/entities/lead.entity';
import { DoctorMessage } from '../doctors/entities/doctor-message.entity';
import { MessageTemplate } from '../message-templates/entities/message-template.entity';
import { AuthModule } from '../auth/auth.module';
import { MobileAuthController } from './mobile-auth.controller';
import { MobileAuthService } from './mobile-auth.service';
import { CallLogEntry } from '../call-log/entities/call-log-entry.entity';
import { MobileCallLogController } from './call-log/mobile-call-log.controller';
import { MobileCallLogService } from './call-log/mobile-call-log.service';
import { MobileLeadsController } from './leads/mobile-leads.controller';
import { MobileLeadsService } from './leads/mobile-leads.service';
import { MobileLeadWritesController } from './leads/mobile-lead-writes.controller';
import { MobileLeadWritesService } from './leads/mobile-lead-writes.service';

/** The wire-compatible surface the Android app talks to (/api/mobile/*). */
@Module({
  imports: [TypeOrmModule.forFeature([User, Company, CompanyMembership, LeadContact, CallResult, UserDoctor, Service, Lead, DoctorMessage, MessageTemplate, CallLogEntry]), AuthModule],
  controllers: [MobileAuthController, MobileLeadsController, MobileLeadWritesController, MobileCallLogController],
  providers: [MobileAuthService, MobileLeadsService, MobileLeadWritesService, MobileCallLogService],
})
export class MobileModule {}
