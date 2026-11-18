import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type Role = {
  id: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
};
type Me = {
  id: string;
  isPresident: boolean;
  permissions: string[];
  roles: Role[];
};

describe('MSP Helwan API (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

  const login = async (email: string, password: string) =>
    (
      (
        await http()
          .post('/api/auth/login')
          .send({ email, password })
          .expect(200)
      ).body as { accessToken: string }
    ).accessToken;
  const me = async (t: string) =>
    (await http().get('/api/auth/me').set(bearer(t)).expect(200)).body as Me;
  const roles = async (t: string) =>
    (await http().get('/api/roles').set(bearer(t)).expect(200)).body as Role[];
  const roleId = async (t: string, name: string) =>
    (await roles(t)).find((r) => r.name === name)!.id;
  /** Invite someone and accept the link; returns their token. */
  const inviteAndJoin = async (
    by: string,
    email: string,
    roleIds: string[],
    password = 'password123',
  ) => {
    const inv = await http()
      .post('/api/invites')
      .set(bearer(by))
      .send({ email, name: 'New Person', roleIds })
      .expect(201);
    const token = (inv.body as { link: string }).link.split('/').pop()!;
    const info = await http().get(`/api/auth/links/${token}`).expect(200);
    expect(info.body).toMatchObject({ type: 'invite', email });
    const joined = await http()
      .post(`/api/auth/links/${token}`)
      .send({ password })
      .expect(200);
    return (joined.body as { accessToken: string }).accessToken;
  };

  let president: string;

  beforeAll(async () => {
    process.env.DATA_DIR = 'memory://';
    if (!process.env.TEST_DATABASE_URL) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'test-secret';
    process.env.FRONTEND_URL = 'https://site.test';
    process.env.BOARD_ACCOUNTS = `boss@test.dev:${hashSync('s3cret!!', 4)}`;
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
    president = await login('Boss@test.dev', 's3cret!!');
  });

  afterAll(() => app.close());

  it('health', () => http().get('/api/health').expect(200, { status: 'ok' }));

  describe('public forms', () => {
    it('validates and saves contact messages', async () => {
      await http()
        .post('/api/contact')
        .send({ name: 'A', email: 'nope', message: 'hi' })
        .expect(400);
      await http()
        .post('/api/contact')
        .send({
          name: 'Mona Ali',
          email: 'mona@example.com',
          message: 'How do I join?',
        })
        .expect(201);
    });

    it('dedupes newsletter sign-ups', async () => {
      const a = await http()
        .post('/api/newsletter')
        .send({ email: 'X@Example.com' });
      expect((a.body as { message: string }).message).toMatch(/Thanks/);
      const b = await http()
        .post('/api/newsletter')
        .send({ email: 'x@example.com' });
      expect((b.body as { message: string }).message).toMatch(/already/);
    });
  });

  describe('bootstrap', () => {
    it('creates the default roles and a President from BOARD_ACCOUNTS', async () => {
      const r = await roles(president);
      expect(r.map((x) => x.name)).toEqual([
        'President',
        'High Board',
        'Board',
        'Member',
      ]);
      const m = await me(president);
      expect(m.isPresident).toBe(true);
      expect(m.permissions).toContain('roles.manage');
    });

    it('rejects bad logins and anonymous admin access', async () => {
      await http()
        .post('/api/auth/login')
        .send({ email: 'boss@test.dev', password: 'wrong' })
        .expect(401);
      await http().get('/api/admin/messages').expect(401);
    });
  });

  describe('invitations and permissions', () => {
    let board: string;

    it('invites a Board member who gets exactly the Board permissions', async () => {
      board = await inviteAndJoin(president, 'board@test.dev', [
        await roleId(president, 'Board'),
      ]);
      const m = await me(board);
      expect(m.permissions).toEqual([
        'members.view',
        'messages.view',
        'subscribers.view',
      ]);
      // Can read messages but not delete them, and can't invite.
      const msgs = await http()
        .get('/api/admin/messages')
        .set(bearer(board))
        .expect(200);
      const id = (msgs.body as { id: string }[])[0].id;
      await http()
        .delete(`/api/admin/messages/${id}`)
        .set(bearer(board))
        .expect(403);
      await http()
        .post('/api/invites')
        .set(bearer(board))
        .send({ email: 'x@test.dev', name: 'X Y', roleIds: [] })
        .expect(403);
    });

    it('does not allow inviting an existing account or reusing a link', async () => {
      await http()
        .post('/api/invites')
        .set(bearer(president))
        .send({ email: 'board@test.dev', name: 'Dup', roleIds: [] })
        .expect(409);
      await http().get('/api/auth/links/not-a-real-token').expect(404);
    });

    it('lets the President create a role with checkboxes and assign people', async () => {
      const created = await http()
        .post('/api/roles')
        .set(bearer(president))
        .send({
          name: 'Recruiter',
          description: 'Invites new members',
          permissions: ['members.view', 'members.invite'],
        })
        .expect(201);
      const id = (created.body as Role).id;
      const boardId = (await me(board)).id;
      await http()
        .put(`/api/roles/${id}/members`)
        .set(bearer(president))
        .send({ userIds: [boardId] })
        .expect(204);
      // Takes effect immediately, same login.
      expect((await me(board)).permissions).toContain('members.invite');
      await http()
        .post('/api/roles')
        .set(bearer(president))
        .send({ name: 'Recruiter', permissions: [] })
        .expect(409);
      await http()
        .post('/api/roles')
        .set(bearer(president))
        .send({ name: 'Bad', permissions: ['launch.rockets'] })
        .expect(400);
    });

    it('blocks handing out more power than you have', async () => {
      // board now has members.invite, but not High Board's permissions.
      await http()
        .post('/api/invites')
        .set(bearer(board))
        .send({
          email: 'hb@test.dev',
          name: 'Hb Person',
          roleIds: [await roleId(board, 'High Board')],
        })
        .expect(403);
      await http()
        .post('/api/invites')
        .set(bearer(board))
        .send({
          email: 'pres2@test.dev',
          name: 'P Two',
          roleIds: [await roleId(board, 'President')],
        })
        .expect(403);
      // A plain Member invite is fine.
      await inviteAndJoin(board, 'member@test.dev', [
        await roleId(board, 'Member'),
      ]);
    });

    it('protects the President role and the last President', async () => {
      const presId = await roleId(president, 'President');
      const myId = (await me(president)).id;
      await http()
        .patch(`/api/roles/${presId}`)
        .set(bearer(president))
        .send({ name: 'King' })
        .expect(403);
      await http()
        .delete(`/api/roles/${presId}`)
        .set(bearer(president))
        .expect(403);
      await http()
        .put(`/api/members/${myId}/roles`)
        .set(bearer(president))
        .send({ roleIds: [] })
        .expect(400);
      await http()
        .put(`/api/roles/${presId}/members`)
        .set(bearer(president))
        .send({ userIds: [] })
        .expect(400);
      await http()
        .patch(`/api/members/${myId}/status`)
        .set(bearer(president))
        .send({ status: 'disabled' })
        .expect(400);
    });

    it('resets passwords via a link and logs out old sessions', async () => {
      const boardId = (await me(board)).id;
      const res = await http()
        .post(`/api/members/${boardId}/reset-link`)
        .set(bearer(president))
        .expect(201);
      const token = (res.body as { link: string }).link.split('/').pop()!;
      expect((res.body as { link: string }).link).toMatch(
        /^https:\/\/site\.test\/set-password\//,
      );
      await http()
        .post(`/api/auth/links/${token}`)
        .send({ password: 'brand-new-pass' })
        .expect(200);
      await http().get('/api/auth/me').set(bearer(board)).expect(401); // old session gone
      await http()
        .post(`/api/auth/links/${token}`)
        .send({ password: 'again12345' })
        .expect(404);
      board = await login('board@test.dev', 'brand-new-pass');
    });

    it('lets members change their own name and password', async () => {
      await http()
        .patch('/api/auth/me')
        .set(bearer(board))
        .send({ name: 'Board Person' })
        .expect(200);
      await http()
        .post('/api/auth/me/password')
        .set(bearer(board))
        .send({ currentPassword: 'wrong', newPassword: 'whatever123' })
        .expect(400);
      const r = await http()
        .post('/api/auth/me/password')
        .set(bearer(board))
        .send({
          currentPassword: 'brand-new-pass',
          newPassword: 'third-pass-123',
        })
        .expect(200);
      board = (r.body as { accessToken: string }).accessToken;
      expect((await me(board)).id).toBeDefined();
    });

    it('disables accounts immediately', async () => {
      const boardId = (await me(board)).id;
      await http()
        .patch(`/api/members/${boardId}/status`)
        .set(bearer(president))
        .send({ status: 'disabled' })
        .expect(204);
      await http().get('/api/auth/me').set(bearer(board)).expect(401);
      await http()
        .post('/api/auth/login')
        .send({ email: 'board@test.dev', password: 'third-pass-123' })
        .expect(401);
    });

    it('lists members and pending invites', async () => {
      await http()
        .post('/api/invites')
        .set(bearer(president))
        .send({
          email: 'pending@test.dev',
          name: 'Pending Person',
          roleIds: [],
        })
        .expect(201);
      const members = await http()
        .get('/api/members')
        .set(bearer(president))
        .expect(200);
      expect((members.body as { email: string }[]).map((m) => m.email)).toEqual(
        expect.arrayContaining([
          'boss@test.dev',
          'board@test.dev',
          'member@test.dev',
        ]),
      );
      const invites = await http()
        .get('/api/invites')
        .set(bearer(president))
        .expect(200);
      expect((invites.body as { email: string }[]).map((i) => i.email)).toEqual(
        ['pending@test.dev'],
      );
    });
  });
});
