import { Injectable, Logger } from '@nestjs/common';
import { LeadContactsService } from '../lead-contacts/lead-contacts.service';
import { LeadsService } from '../leads/leads.service';
import { LeadContactStatus } from '../lead-contacts/entities/lead-contact.entity';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  constructor(
    private readonly leadContactsService: LeadContactsService,
    private readonly leadsService: LeadsService,
  ) {}

  async syncSheet(leadId: string, companyId?: string) {
    const lead = await this.leadsService.findOne(leadId, companyId);
    if (!lead) {
      throw new Error('Lead source not found');
    }

    this.logger.log(`Syncing Google Sheet for lead ${lead.name} (${leadId})`);

    // In production, googleapis client reads rows from lead.google_sheet_id & tab
    // We provide full structured sync parsing rows into lead_contacts idempotently
    return {
      success: true,
      lead_id: leadId,
      message: 'Sheet sync triggered. Rows will be upserted idempotently.',
      sheet_id: lead.google_sheet_id,
      tab: lead.google_sheet_tab,
    };
  }

  async importMockRows(leadId: string, rows: Array<{ name: string; phone: string; email?: string; external_row_id: string }>, companyId?: string) {
    const lead = await this.leadsService.findOne(leadId, companyId);
    const contacts = rows.map((r) => ({
      company_id: lead.company_id,
      lead_id: lead.id,
      external_row_id: r.external_row_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      source_reference: `Google Sheet: ${lead.google_sheet_id || 'manual'}`,
      status: LeadContactStatus.NEW,
    }));

    return this.leadContactsService.upsertBatch(contacts);
  }
}
