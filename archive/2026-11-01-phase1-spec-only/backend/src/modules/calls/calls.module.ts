import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Call } from './entities/call.entity';
import { LeadContact } from '../lead-contacts/entities/lead-contact.entity';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Call, LeadContact])],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
