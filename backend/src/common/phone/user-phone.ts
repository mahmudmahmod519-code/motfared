import { BadRequestException, ConflictException } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { User, UserStatus } from '../../modules/users/entities/user.entity';
import { toCanonicalPhone } from './phone';

/** Users whose phone counts for uniqueness and who may sign in. */
export const LIVE_STATUSES = [UserStatus.ACTIVE, UserStatus.PENDING];

/** Validates a phone supplied through an API and returns the stored value plus its canonical key. */
export function phoneFields(phone: string): { phone: string; phone_key: string } {
  const key = toCanonicalPhone(phone);
  if (!key) throw new BadRequestException('Invalid phone number');
  return { phone: phone.trim(), phone_key: key };
}

/** 409 when another pending/active user already owns the phone (D7: unique among active users). */
export async function assertPhoneFree(repo: Repository<User>, phoneKey: string, exceptUserId?: string) {
  const owner = await repo.findOne({ where: { phone_key: phoneKey, status: In(LIVE_STATUSES) }, select: { id: true } });
  if (owner && owner.id !== exceptUserId) {
    throw new ConflictException('Phone number is already used by another active user');
  }
}

/** Maps the database's unique-index violation (a race the pre-check cannot see) to the same 409. */
export function rethrowPhoneConflict(e: any): never {
  const code = e?.code ?? e?.driverError?.code;
  if (code === 'ER_DUP_ENTRY' && /active_phone_key/i.test(String(e?.sqlMessage ?? e?.driverError?.sqlMessage ?? e?.message))) {
    throw new ConflictException('Phone number is already used by another active user');
  }
  throw e;
}
