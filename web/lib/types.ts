/** The API's shapes for the pages built so far (saas-crm/backend: features/clinics, modules/services, company-memberships). */

/** A team: the original's groups A / B / C, now a company's own list. `code` is what the original showed. */
export interface Team {
  id: number;
  name: string;
  code: string;
}

export interface Campaign {
  id: number;
  doctor_id: number;
  name: string;
  created_at: string;
}

/** GET /api/doctors (list) and /api/doctors/:id (with campaigns). */
export interface Doctor {
  id: number;
  name: string;
  team_id: number | null;
  team: Team | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  slug: string | null;
  active: boolean;
  campaigns_count?: number;
  campaigns?: Campaign[];
}

/** GET /api/services */
export interface Service {
  id: number;
  name: string;
  active: boolean;
}

export type UserStatus = 'pending' | 'active' | 'inactive' | 'suspended';

/** GET /api/company-memberships: one per account in the company, with the account itself. */
export interface Membership {
  id: string;
  user_id: string;
  role: string;
  team_id: number | null;
  unrestricted: boolean;
  status: 'active' | 'inactive' | 'suspended';
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: UserStatus;
  } | null;
}
