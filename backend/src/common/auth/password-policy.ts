import { BadRequestException } from '@nestjs/common';
import { toCanonicalPhone } from '../phone/phone';

/** One policy for every place a password is set (register, change, mobile change, imports). */
export const PASSWORD_MIN_LENGTH = 8;
/** Upper bound only protects the hasher from huge inputs; it is not a complexity rule. */
export const PASSWORD_MAX_LENGTH = 128;

/** Checks that depend on the account (the DTO covers length): not the phone number, not the current password. */
export function assertAcceptablePassword(newPassword: string, account: { phone_key?: string | null }) {
  const asPhone = toCanonicalPhone(newPassword);
  if (asPhone && account.phone_key && asPhone === account.phone_key) {
    throw new BadRequestException('Password must not be your phone number');
  }
}
