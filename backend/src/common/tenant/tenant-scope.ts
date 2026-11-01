import { BadRequestException, ForbiddenException } from '@nestjs/common';

export const PLATFORM_ADMIN = 'platform_admin';

/**
 * Who is making the request, as resolved from the database by JwtStrategy on every request.
 * It is the only description of the caller the rest of the code may use: nothing here comes from
 * the token's payload (beyond the user id) or from anything the client sends.
 */
export interface TenantPrincipal {
  id: string;
  email: string;
  /** Display name, for the sidebar and greetings. */
  name: string;
  /** The company of the active membership; null for platform admins and for members without an active membership. */
  company_id: string | null;
  /** Membership role key within `company_id`. */
  role: string | null;
  /** What that role may do in this company (see RbacService); the only thing permission checks look at. */
  permissions: string[];
  platform_role: typeof PLATFORM_ADMIN | null;
  /** Legacy team (group) of the user; carried for the team-scoping rules that D-11 defers. */
  team_id: number | null;
  /** True while a temporary password is in place; JwtAuthGuard then allows only the password-change routes. */
  must_change_password: boolean;
}

/** What the helpers read: complete principals, or the few fields a unit test cares about. */
export type PrincipalLike = Partial<TenantPrincipal> | null | undefined;

export const isPlatformAdmin = (user: PrincipalLike): boolean => user?.platform_role === PLATFORM_ADMIN;

/** True only when `permission` is on the principal's list: a role name or a platform role grants nothing. */
export const hasPermission = (user: PrincipalLike, permission: string): boolean =>
  Array.isArray(user?.permissions) && user!.permissions.includes(permission);

/**
 * Company a request may touch, taken ONLY from the verified principal.
 * Returns undefined for platform admins (unrestricted); throws for anyone else
 * without a company, so "no company" can never degrade into "all companies".
 */
export function tenantScope(user: PrincipalLike): string | undefined {
  if (isPlatformAdmin(user)) return undefined;
  if (!user?.company_id) throw new ForbiddenException('No company is associated with this account');
  return user.company_id;
}

/** Company filter for list/read calls; a platform admin may narrow with ?company_id. */
export function listScope(user: PrincipalLike, requested?: string): string | undefined {
  return tenantScope(user) ?? requested;
}

/** Company to stamp on a new row: always the caller's own, except platform admins, who must name one. */
export function writeCompany(user: PrincipalLike, requested?: string): string {
  const scope = tenantScope(user);
  if (scope) return scope;
  if (!requested) throw new BadRequestException('company_id is required');
  return requested;
}
