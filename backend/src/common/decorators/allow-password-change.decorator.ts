import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_KEY = 'allowPasswordChange';

/**
 * Marks a route that an account flagged `must_change_password` may still call: reading the
 * profile, signing out and changing the password. Everything else answers 403
 * PASSWORD_CHANGE_REQUIRED (see JwtAuthGuard).
 */
export const AllowPasswordChange = () => SetMetadata(ALLOW_PASSWORD_CHANGE_KEY, true);
