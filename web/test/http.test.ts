import { describe, expect, it } from 'vitest';
import { errorMessage } from '../lib/http';

describe('errorMessage: what a failed request tells the user', () => {
  it('keeps the API\'s own Arabic wording', () => {
    expect(errorMessage(409, { message: 'اللينك ده مستخدم عند عيادة تانية - اختار اسم تاني', code: 'SLUG_TAKEN' })).toBe(
      'اللينك ده مستخدم عند عيادة تانية - اختار اسم تاني',
    );
  });

  it('states the entitlement codes in plain words', () => {
    expect(errorMessage(402, { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired' })).toMatch(/الاشتراك منتهي/);
    expect(errorMessage(403, { code: 'COMPANY_SUSPENDED' })).toMatch(/موقوف/);
  });

  it('translates the English messages a dashboard user can cause', () => {
    expect(errorMessage(409, { message: 'Email already exists' })).toBe('الإيميل ده متسجّل لحساب تاني');
    expect(errorMessage(409, { message: 'Phone number is already used by another active user' })).toBe('رقم التليفون ده مستخدم لحساب تاني');
    expect(errorMessage(403, { message: 'Not allowed to change: phone' })).toBe('مش مسموح لك تعمل ده');
    expect(errorMessage(400, { message: ['email must be an email'] })).toBe('الإيميل مش مكتوب صح');
  });

  it('falls back by status, never showing raw English', () => {
    expect(errorMessage(0, null)).toBe('مفيش اتصال بالسيرفر، جرّب تاني');
    expect(errorMessage(401, {})).toMatch(/سجّل دخول/);
    expect(errorMessage(403, { message: 'Forbidden resource' })).toBe('مش مسموح لك تعمل ده');
    expect(errorMessage(400, { message: ['name should not be empty'] })).toBe('البيانات دي مش مظبوطة، راجعها وجرّب تاني');
    expect(errorMessage(500, 'oops')).toBe('حصلت مشكلة، جرّب تاني');
  });
});
