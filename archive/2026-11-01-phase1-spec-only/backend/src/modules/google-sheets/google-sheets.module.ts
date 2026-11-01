import { Module } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service';
import { GoogleSheetsController } from './google-sheets.controller';
import { LeadContactsModule } from '../lead-contacts/lead-contacts.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [LeadContactsModule, LeadsModule],
  controllers: [GoogleSheetsController],
  providers: [GoogleSheetsService],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
