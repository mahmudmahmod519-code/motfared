import { BadRequestException, ForbiddenException, HttpException, UnauthorizedException } from '@nestjs/common';
import { MobileExceptionFilter } from './mobile-exception.filter';

function run(exception: HttpException) {
  const sent: { status?: number; body?: any } = {};
  const res = { status: (s: number) => ({ json: (b: any) => { sent.status = s; sent.body = b; } }) };
  const host: any = { switchToHttp: () => ({ getResponse: () => res }) };
  new MobileExceptionFilter().catch(exception, host);
  return sent;
}

describe('MobileExceptionFilter (legacy {error} contract)', () => {
  it('puts a human message in `error`, as the Android app reads it', () => {
    const r = run(new UnauthorizedException('Invalid phone or password'));
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Invalid phone or password');
  });

  it('joins validation message arrays', () => {
    const r = run(new BadRequestException(['phone must be a string', 'password should not be empty']));
    expect(r.body.error).toBe('phone must be a string; password should not be empty');
  });

  it('keeps the machine-readable restriction fields and moves the old error type aside', () => {
    const r = run(
      new HttpException(
        { statusCode: 402, error: 'SubscriptionRestricted', code: 'SUBSCRIPTION_EXPIRED', message: 'Your subscription has expired. Renew to continue.', subscription_state: 'expired' },
        402,
      ),
    );
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({
      error: 'Your subscription has expired. Renew to continue.',
      code: 'SUBSCRIPTION_EXPIRED',
      subscription_state: 'expired',
      error_type: 'SubscriptionRestricted',
    });
  });

  it('works for plain 403s with a string body', () => {
    expect(run(new ForbiddenException('nope')).body).toMatchObject({ error: 'nope', statusCode: 403 });
  });
});
