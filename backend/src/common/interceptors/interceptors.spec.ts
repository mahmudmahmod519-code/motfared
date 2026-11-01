/**
 * Unit Tests - Logging Interceptor
 */

import { ExecutionContext } from '@nestjs/common';
import { LoggingInterceptor } from './logging.interceptor';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should intercept and log requests', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          url: '/api/test',
          ip: '127.0.0.1',
        }),
      }),
    } as any;

    const call = {
      handle: () => of({ message: 'success' }),
    } as any;

    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    interceptor.intercept(context, call).subscribe(() => {
      expect(spy).toHaveBeenCalled();
    });

    spy.mockRestore();
  });
});

/**
 * Unit Tests - Sensitive Data Interceptor
 */

import { SensitiveDataInterceptor } from './sensitive-data.interceptor';

describe('SensitiveDataInterceptor', () => {
  let interceptor: SensitiveDataInterceptor;

  beforeEach(() => {
    interceptor = new SensitiveDataInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should strip sensitive data from response', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/api/test' }),
      }),
    } as any;

    const call = {
      handle: () => of({
        id: '1',
        name: 'Test',
        password_hash: 'secret-hash',
        email: 'test@example.com',
        credit_card: '1234-5678-9012-3456',
        cvv: '123',
      }),
    } as any;

    interceptor.intercept(context, call).subscribe((result) => {
      expect(result.password_hash).toBeUndefined();
      expect(result.credit_card).toBeUndefined();
      expect(result.cvv).toBeUndefined();
      expect(result.name).toBe('Test');
      expect(result.email).toBe('test@example.com');
    });
  });
});
