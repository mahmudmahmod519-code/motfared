import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { ALLOW_FIELDS_KEY } from '../decorators/allow-fields.decorator';

const SENSITIVE_FIELDS = ['password_hash', 'password', 'token', 'refresh_token'];

function stripSensitive(obj: any, allowed: string[] = []): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((o) => stripSensitive(o, allowed));
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELDS.includes(key) && !allowed.includes(key)) continue;
    result[key] = stripSensitive(obj[key], allowed);
  }
  return result;
}

@Injectable()
export class SensitiveDataInterceptor implements NestInterceptor {
  constructor(@Optional() private readonly reflector?: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const allowed = this.reflector?.getAllAndOverride<string[]>(ALLOW_FIELDS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    return next.handle().pipe(map((data) => stripSensitive(data, allowed)));
  }
}
