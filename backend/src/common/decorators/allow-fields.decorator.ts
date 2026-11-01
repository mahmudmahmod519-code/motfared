import { SetMetadata } from '@nestjs/common';

export const ALLOW_FIELDS_KEY = 'allowSensitiveFields';

/**
 * Lets named top-level fields through SensitiveDataInterceptor on one route. Used where the
 * response contract genuinely contains a credential the caller must receive (the mobile
 * login returns the session `token`). Password hashes are never allowed.
 */
export const AllowFields = (...fields: string[]) => SetMetadata(ALLOW_FIELDS_KEY, fields.filter((f) => f !== 'password_hash'));
