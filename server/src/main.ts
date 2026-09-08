import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { missingProdSecrets } from './common/security';

/** 生产环境启动前安全闸门：拒绝缺失或沿用示例占位的关键密钥（闸门 C Medium 修复） */
function assertProductionSecrets() {
  const problems = missingProdSecrets(process.env);
  if (problems.length) {
    throw new Error(`生产环境拒绝启动：以下环境变量缺失或仍为示例占位值，请先配置：${problems.join(', ')}`);
  }
}

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1');
  app.use(json({ limit: '4mb' }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: true, credentials: true });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`API listening on http://0.0.0.0:${port}/api/v1`, 'Bootstrap');
}
bootstrap();
