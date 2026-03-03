import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { runWithRequestContext } from './common/request-context.js';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestIdHeader = req.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string' && requestIdHeader.trim().length > 0
        ? requestIdHeader.trim()
        : randomUUID();
    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress =
      typeof forwardedFor === 'string'
        ? forwardedFor.split(',')[0]?.trim() || req.ip || null
        : req.ip || null;
    const userAgentHeader = req.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string' ? userAgentHeader : null;

    res.setHeader('x-request-id', requestId);
    runWithRequestContext({ requestId, ipAddress, userAgent }, () => next());
  });

  const port = process.env.PORT || process.env.BACKEND_PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend running on http://0.0.0.0:${port}/api`);
}

bootstrap();
