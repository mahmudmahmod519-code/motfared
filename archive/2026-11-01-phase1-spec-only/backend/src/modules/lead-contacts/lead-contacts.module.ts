import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadContact } from './entities/lead-contact.entity';
import { LeadContactsService } from './lead-contacts.service';
import { LeadContactsController } from './lead-contacts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeadContact])],
  controllers: [LeadContactsController],
  providers: [LeadContactsService],
  exports: [LeadContactsService],
})
export class LeadContactsModule {}
