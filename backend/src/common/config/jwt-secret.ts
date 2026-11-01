import { Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

const KNOWN_WEAK = new Set(['change-me-in-production', 'changeme', 'secret']);
const MIN_LENGTH = 32;
let ephemeral: string | undefined;

/**
 * Single source of truth for the JWT signing secret (used by JwtModule and JwtStrategy).
 * - A configured secret must be at least 32 chars and not a known placeholder.
 * - Production refuses to start otherwise.
 * - Elsewhere an unusable secret is replaced by a random per-process one (sessions
 *   do not survive a restart), so a placeholder value can never sign real tokens.
 */
export function resolveJwtSecret(value: string | undefined, nodeEnv = process.env.NODE_ENV): string {
  if (value && value.length >= MIN_LENGTH && !KNOWN_WEAK.has(value)) return value;
  if (nodeEnv === 'production') {
    throw new Error(`JWT_SECRET must be set to a random value of at least ${MIN_LENGTH} characters in production`);
  }
  if (!ephemeral) {
    ephemeral = randomBytes(48).toString('hex');
    new Logger('JwtSecret').warn(
      `JWT_SECRET is missing, too short or a placeholder; using a random per-process secret (set a ${MIN_LENGTH}+ char value to persist sessions).`,
    );
  }
  return ephemeral;
}
