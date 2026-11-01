import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Everything the running app and the integration tests share, so the tests exercise the same HTTP
 * pipeline as production (CORS stays in main.ts: it depends on the deployment). The app must be created
 * with `rawBody: true` (webhook signatures are computed over the raw bytes).
 */
/** `TRUST_PROXY=<hops>`: how many reverse proxies stand in front of the API (the web app, a load balancer). Anything else is ignored. */
export function trustedProxyHops(raw: string | undefined): number | undefined {
  if (!raw || !/^[1-3]$/.test(raw.trim())) return undefined;
  return Number(raw.trim());
}

export function configureApp(app: NestExpressApplication) {
  // Behind a proxy the client's address (rate limits, logs) comes from X-Forwarded-For, but only when the
  // deployment says so: believing that header from anyone would let a client choose its own address.
  const hops = trustedProxyHops(process.env.TRUST_PROXY);
  if (hops) app.set('trust proxy', hops);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  // The call-log sync body legitimately grows (200 entries with contact names pass 100 KB; a 413 there
  // left the app retrying the same batch forever), so JSON bodies may be up to 1 MB.
  app.useBodyParser('json', { limit: '1mb' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
