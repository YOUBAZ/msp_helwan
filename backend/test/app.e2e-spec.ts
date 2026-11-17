import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type Msg = { message: unknown };

describe('MSP Helwan API (e2e)', () => {
  let app: INestApplication<App>;
  const dataDir = mkdtempSync(join(tmpdir(), 'msp-api-'));

  beforeAll(async () => {
    process.env.DATA_DIR = dataDir;
    process.env.JWT_SECRET = 'test-secret';
    process.env.BOARD_ACCOUNTS = `board@test.dev:${hashSync('s3cret!', 4)}`;
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('GET /api/health', () =>
    request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' }));

  it('rejects an invalid contact message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/contact')
      .send({ name: 'A', email: 'nope', message: 'hi' })
      .expect(400);
    expect(Array.isArray((res.body as Msg).message)).toBe(true);
  });

  it('accepts a valid contact message', () =>
    request(app.getHttpServer())
      .post('/api/contact')
      .send({
        name: 'Mona Ali',
        email: 'mona@example.com',
        message: 'How do I join?',
      })
      .expect(201));

  it('subscribes once and dedupes case-insensitively', async () => {
    const s = request(app.getHttpServer());
    const a = await s
      .post('/api/newsletter')
      .send({ email: 'X@Example.com' })
      .expect(201);
    expect((a.body as Msg).message).toMatch(/subscribed!/);
    const b = await request(app.getHttpServer())
      .post('/api/newsletter')
      .send({ email: 'x@example.com' })
      .expect(201);
    expect((b.body as Msg).message).toMatch(/already/);
  });

  it('blocks admin routes without a token', () =>
    request(app.getHttpServer()).get('/api/admin/messages').expect(401));

  it('rejects bad credentials', () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'board@test.dev', password: 'wrong' })
      .expect(401));

  it('logs in and reads + deletes submissions', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'Board@test.dev', password: 's3cret!' })
      .expect(200);
    const auth = {
      Authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}`,
    };

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(auth)
      .expect(200);
    expect((me.body as { email: string }).email).toBe('board@test.dev');

    const msgs = await request(app.getHttpServer())
      .get('/api/admin/messages')
      .set(auth)
      .expect(200);
    const list = msgs.body as { id: string }[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: 'Mona Ali',
      email: 'mona@example.com',
    });

    const subs = await request(app.getHttpServer())
      .get('/api/admin/subscribers')
      .set(auth)
      .expect(200);
    expect(subs.body).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/admin/messages/${list[0].id}`)
      .set(auth)
      .expect(204);
    const after = await request(app.getHttpServer())
      .get('/api/admin/messages')
      .set(auth)
      .expect(200);
    expect(after.body).toHaveLength(0);
  });
});
