import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

/**
 * The Android app reads a human message from `error` (`json.optString("error", …)`), as the
 * legacy backend returned it. Nest's default body has `message` (sometimes an array) and
 * uses `error` for the status name. On /api/mobile routes this puts the message in `error`
 * and keeps everything else (`code`, `subscription_state`, `statusCode`, …) so the app can
 * also switch on the machine-readable fields. A previous `error` type name moves to `error_type`.
 */
@Catch(HttpException)
export class MobileExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const body: Record<string, any> = typeof raw === 'string' ? { message: raw } : { ...(raw as object) };

    const message = Array.isArray(body.message) ? body.message.join('; ') : body.message ?? exception.message;
    if (typeof body.error === 'string' && body.error !== message) body.error_type = body.error;
    body.error = message;
    body.message = message;
    body.statusCode = status;
    res.status(status).json(body);
  }
}
