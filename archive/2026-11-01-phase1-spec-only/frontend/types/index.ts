// Centralized TypeScript interfaces for API responses

export type UserRole = 'platform_admin' | 'ceo' | 'crm_manager' | 'call_center';

export interface User {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  platform_role?: string;
  company_id?: string;
  status?: string;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  type_company?: string;
  description?: string;
  client_label?: string;
  call_center_label?: string;
  crm_manager_label?: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  address?: string;
  phone_whatsapp?: string;
  phone_telephone?: string;
  domain?: string;
  isActive?: boolean;
  subscriptionStatus?: 'active' | 'inactive' | 'trial' | 'expired';
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadSource {
  id: string;
  name: string;
  source_type: string;
  company_id: string;
  is_active: boolean;
  google_sheet_id?: string;
  google_sheet_tab?: string;
  notes?: string;
  description?: string;
  type?: string;
  contactsCount?: number;
  isActive?: boolean;
  lead_contacts?: LeadContact[];
  created_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadContact {
  id: string;
  name: string;
  phone: string;
  telephone?: string;
  email?: string;
  age?: number;
  status: 'new' | 'queued' | 'assigned' | 'in_progress' | 'converted' | 'rejected' | 'do_not_contact' | 'archived';
  company_id: string;
  lead_id: string;
  lead?: LeadSource;
  leadSource?: LeadSource;
  leadSourceId?: string;
  assignedUser?: User;
  assignedUserId?: string;
  external_row_id?: string;
  source_reference?: string;
  created_at?: string;
  createdAt?: string;
}

export interface PlanSale {
  id: string;
  name: string;
  company_id: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'canceled';
  info?: string;
  description?: string;
  limit_calls?: number;
  limit_bonus_calls?: number;
  created_by?: string;
  creator?: User;
  lead_items?: LeadItem[];
  created_at?: string;
}

export interface LeadItem {
  id: string;
  lead_id: string;
  plan_sales_id: string;
  status: 'active' | 'paused' | 'completed' | 'canceled';
  lead?: LeadSource;
  lead_item_call_centers?: LeadItemCallCenter[];
}

export interface LeadItemCallCenter {
  id: string;
  lead_item_id: string;
  user_id: string;
  assignment_role: 'primary' | 'secondary';
  status: 'active' | 'paused' | 'completed' | 'canceled';
  target_calls?: number;
  bonus_calls_limit?: number;
  user?: User;
}

export interface Call {
  id: string;
  company_id: string;
  lead_contact_id: string;
  lead_contact?: LeadContact;
  call_center_user_id: string;
  call_center_user?: User;
  outcome: 'answered' | 'no_answer' | 'busy' | 'rejected' | 'callback_requested' | 'wrong_number' | 'voicemail';
  customer_decision?: 'interested' | 'accepted' | 'rejected' | 'needs_follow_up' | 'undecided';
  duration_seconds?: number;
  notes?: string;
  called_at: string;
  created_at?: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  company?: Company;
  plan_price_id: string;
  plan_price?: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
    plan?: {
      name: string;
      slug: string;
      description?: string;
      features?: Record<string, any>;
    };
  };
  status: 'incomplete' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'unpaid';
  starts_at: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  created_at?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  status: 'active' | 'inactive';
  company_id: string;
  created_at?: string;
}

export interface DashboardStats {
  totalCompanies?: number;
  totalUsers?: number;
  totalSubscriptions?: number;
  activeSubscriptions?: number;
  totalRevenue?: number;
  totalLeads?: number;
  totalContacts?: number;
  totalCalls?: number;
  answeredCalls?: number;
  totalTasks?: number;
}
