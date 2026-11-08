import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Every lab endpoint lives under /api so the web app can proxy one prefix.
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  // Global cross-cutting pieces (filters, pipes, interceptors) get registered
  // here once the corresponding labs exist — see docs/ARCHITECTURE.md.

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}/api`);
}
bootstrap();
