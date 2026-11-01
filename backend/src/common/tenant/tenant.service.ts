import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Lead } from '../../modules/leads/entities/lead.entity';
import { LeadContact } from '../../modules/lead-contacts/entities/lead-contact.entity';
import { PlanSales } from '../../modules/plan-sales/entities/plan-sales.entity';
import { LeadItem } from '../../modules/lead-items/entities/lead-item.entity';
import { LeadItemCallCenter } from '../../modules/lead-item-call-centers/entities/lead-item-call-center.entity';
import { User } from '../../modules/users/entities/user.entity';
import { Doctor } from '../../modules/doctors/entities/doctor.entity';
import { Subscription } from '../../modules/subscriptions/entities/subscription.entity';

export type OwnedKind = 'lead' | 'lead_contact' | 'plan_sales' | 'lead_item' | 'assignment' | 'user' | 'subscription' | 'doctor';

/** Verifies that a referenced row belongs to a given company (guards cross-tenant foreign keys). */
@Injectable()
export class TenantService {
  constructor(private readonly ds: DataSource) {}

  private async companyOf(kind: OwnedKind, id: string): Promise<string | null | undefined> {
    const direct = { lead: Lead, lead_contact: LeadContact, plan_sales: PlanSales, user: User, subscription: Subscription, doctor: Doctor } as const;
    if (kind in direct) {
      const row: any = await this.ds.getRepository((direct as any)[kind]).findOne({ where: { id } as any, select: { id: true, company_id: true } as any });
      return row ? row.company_id : undefined;
    }
    if (kind === 'lead_item') {
      const row = await this.ds.getRepository(LeadItem).findOne({ where: { id }, relations: ['plan_sales'] });
      return row ? row.plan_sales?.company_id : undefined;
    }
    const row = await this.ds.getRepository(LeadItemCallCenter).findOne({ where: { id }, relations: ['lead_item', 'lead_item.plan_sales'] });
    return row ? row.lead_item?.plan_sales?.company_id : undefined;
  }

  /** Throws 404 when the row does not exist or belongs to another company. */
  async assertOwned(kind: OwnedKind, id: string | undefined | null, companyId: string): Promise<void> {
    if (!id) return;
    const owner = await this.companyOf(kind, id);
    if (owner === undefined || owner !== companyId) {
      throw new NotFoundException(`${kind.replace('_', ' ')} ${id} not found`);
    }
  }
}
