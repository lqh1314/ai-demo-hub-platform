import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';

import { AuthController } from '../src/iam/auth.controller';
import { AuthService } from '../src/iam/auth.service';
import { RbacService } from '../src/iam/rbac.service';
import { HealthController } from '../src/common/health.controller';
import { PrismaService } from '../src/common/prisma.service';
import { RedisService } from '../src/common/redis.service';
import { JwtAuthGuard } from '../src/common/auth.guard';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { TokenService } from '../src/common/token.service';

/**
 * 接口集成测试：真实跑通 HTTP -> 全局JWT守卫 -> ValidationPipe -> Controller -> Service -> (模拟)Prisma -> 异常过滤器 全链路。
 * 仅把数据库/缓存这两个外部依赖替换为内存 mock，因此无需 PostgreSQL/Redis 即可在任意环境执行。
 * 覆盖：正常路径 / 鉴权失败 / 参数非法 / 依赖异常 四类。
 */
describe('HTTP 接口集成（auth + health，全链路）', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  const hash = bcrypt.hashSync('Aihub@123456', 4);
  const baseUser = {
    id: 'u-1', username: 'admin', realName: '管理员', roleAlias: 'ADMIN',
    tenantId: 't-1', deptId: null, mobile: null, email: null, avatarUrl: null, jobNo: null,
    status: 'ACTIVE', failCount: 0, lockedUntil: null, passwordHash: hash, deletedAt: null,
  };
  const prismaMock: any = {
    user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const redisMock: any = { mode: 'memory', get: jest.fn(), set: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, HealthController],
      providers: [
        AuthService, RbacService,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => { await app?.close(); });

  beforeEach(() => jest.clearAllMocks());

  describe('健康探针', () => {
    it('liveness 不依赖外部组件恒 200', async () => {
      const r = await http.get('/api/v1/health/live').expect(200);
      expect(r.body.status).toBe('ok');
    });
    it('readiness 在数据库可达时 200 并上报缓存模式', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const r = await http.get('/api/v1/health/ready').expect(200);
      expect(r.body.database).toBe('up');
      expect(r.body.cache).toBe('memory');
    });
    it('readiness 在数据库异常时返回 503（依赖异常路径）', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('connect ECONNREFUSED'));
      const r = await http.get('/api/v1/health/ready').expect(503);
      expect(r.body.code).toBe('NOT_READY');
      expect(r.body.details.database).toBe('down');
    });
  });

  describe('鉴权守卫', () => {
    it('未带令牌访问受保护接口 -> 401 UNAUTHORIZED', async () => {
      const r = await http.get('/api/v1/auth/me').expect(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    });
    it('携带非法令牌 -> 401 TOKEN_INVALID', async () => {
      const r = await http.get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
      expect(r.body.code).toBe('TOKEN_INVALID');
    });
    it('携带合法令牌 -> 200 返回当前用户', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...baseUser, dept: null });
      const token = TokenService.signAccess({ sub: 'u-1', tenantId: 't-1', realName: '管理员', roleAlias: 'ADMIN', permissions: ['*'] });
      const r = await http.get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(r.body.username).toBe('admin');
      expect(r.body.permissions).toContain('*');
    });
  });

  describe('POST /auth/login', () => {
    it('参数非法（缺字段/密码过短）-> 400，且不触达数据库', async () => {
      const r = await http.post('/api/v1/auth/login').send({ username: 'a' }).expect(400);
      expect(r.body.code).toBe('BAD_REQUEST');
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
    });
    it('用户不存在 -> 401 账号或密码错误', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);
      const r = await http.post('/api/v1/auth/login').send({ username: 'ghost', password: 'whatever1' }).expect(401);
      expect(r.body.code).toBe('UNAUTHORIZED');
    });
    it('账号停用 -> 403 FORBIDDEN', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...baseUser, status: 'DISABLED' });
      const r = await http.post('/api/v1/auth/login').send({ username: 'admin', password: 'Aihub@123456' }).expect(403);
      expect(r.body.code).toBe('FORBIDDEN');
    });
    it('密码错误 -> 401 且失败计数 +1 落库', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...baseUser });
      prismaMock.user.update.mockResolvedValue({});
      await http.post('/api/v1/auth/login').send({ username: 'admin', password: 'wrong-password' }).expect(401);
      expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failCount: 1 }) }));
    });
    it('正常登录 -> 201 返回双令牌/权限/用户，并清零失败计数', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ ...baseUser });
      prismaMock.user.update.mockResolvedValue({});
      const r = await http.post('/api/v1/auth/login').send({ username: 'admin', password: 'Aihub@123456' }).expect(201);
      expect(r.body.accessToken).toEqual(expect.any(String));
      expect(r.body.refreshToken).toEqual(expect.any(String));
      expect(r.body.user.username).toBe('admin');
      expect(r.body.permissions).toContain('*');
      expect(prismaMock.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ failCount: 0 }) }));
    });
    it('数据库抛错 -> 500 INTERNAL_ERROR 且不泄漏内部信息（依赖异常路径）', async () => {
      prismaMock.user.findFirst.mockRejectedValue(new Error('connection pool exhausted'));
      const r = await http.post('/api/v1/auth/login').send({ username: 'admin', password: 'Aihub@123456' }).expect(500);
      expect(r.body.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(r.body)).not.toContain('connection pool exhausted');
    });
  });
});
