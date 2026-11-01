import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'requirePermission';

export interface PermissionRequirement {
  /** The caller's role in their company must grant ALL of these. */
  permissions: string[];
  /** Platform admins have no company permissions; they pass only where a route admits them explicitly. */
  platformAdmin: boolean;
}

/** `@RequirePermission('billing.manage')`: members whose role grants every listed permission. */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata<string, PermissionRequirement>(REQUIRE_PERMISSION_KEY, { permissions, platformAdmin: false });

/** Same, but platform admins are admitted as well (routes that listed `platform_admin` before). */
export const RequirePermissionOrPlatform = (...permissions: string[]) =>
  SetMetadata<string, PermissionRequirement>(REQUIRE_PERMISSION_KEY, { permissions, platformAdmin: true });
