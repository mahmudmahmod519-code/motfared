import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * Build the list of allowed CORS origins from environment variables.
 * Supports both web frontend and mobile apps simultaneously.
 */
function getAllowedOrigins(): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [];

  // 1. Web Frontend (production + local)
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  origins.push('http://localhost:3001'); // Local frontend dev
  origins.push('http://localhost:3000'); // Local backend dev (if frontend served from backend)

  // 2. Mobile Apps (Capacitor, Ionic, React Native WebView, Expo)
  origins.push('capacitor://localhost');
  origins.push('ionic://localhost');
  origins.push('http://localhost');
  origins.push('https://localhost');

  // Expo development
  origins.push('exp://127.0.0.1:8081');
  origins.push('exp://192.168.1.*:8081');
  origins.push('exp://10.0.2.2:8081'); // Android emulator

  // 3. Railway Preview Deployments (auto-generated domains)
  origins.push(/^https:\/\/.*\.railway\.app$/);

  // 4. Custom domains from env (comma-separated)
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) origins.push(trimmed);
    });
  }

  // 5. Mobile-specific origins from env (comma-separated)
  if (process.env.MOBILE_CORS_ORIGINS) {
    process.env.MOBILE_CORS_ORIGINS.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed) origins.push(trimmed);
    });
  }

  return origins;
}

async function bootstrap() {
  // rawBody: the raw bytes are needed to verify webhook signatures
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  configureApp(app);

  // CORS - Supports Web Frontend + Mobile Apps simultaneously
  const allowedOrigins = getAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // Mobile apps and some tools don't send Origin header
      if (!origin) {
        return callback(null, true);
      }

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return allowed === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        // Log blocked origins for debugging (remove in production if noisy)
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[CORS] Blocked origin: ${origin}`);
          console.log(`[CORS] Allowed: ${allowedOrigins.map((a) => (a instanceof RegExp ? a.source : a)).join(', ')}`);
        }
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Request-ID',
      'X-Device-ID',
      'X-App-Version',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Request-ID'],
    maxAge: 86400, // 24 hours preflight cache
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
  console.log(`🌐 CORS enabled for: ${allowedOrigins.map((a) => (a instanceof RegExp ? a.source : a)).join(', ')}`);
}
bootstrap();