import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { type Mail, MailService } from '../src/mail/mail.service';

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
  profile: Record<string, unknown> & { complete: boolean };
};

describe('MSP Tech Club API (e2e)', () => {
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
    const body = inv.body as { link: string; emailSent: boolean };
    expect(body.emailSent).toBe(true);
    const mail = lastMailTo(email)!;
    expect(mail.subject).toMatch(/invited/);
    expect(mail.text).toContain(body.link);
    const token = body.link.split('/').pop()!;
    const info = await http().get(`/api/auth/links/${token}`).expect(200);
    expect(info.body).toMatchObject({ type: 'invite', email });
    const joined = await http()
      .post(`/api/auth/links/${token}`)
      .send({ password })
      .expect(200);
    return (joined.body as { accessToken: string }).accessToken;
  };

  let president: string;
  const outbox: Mail[] = [];
  const fakeMail = {
    enabled: true,
    notifyTo: 'club@test.dev',
    send: (m: Mail) => {
      outbox.push(m);
      return Promise.resolve(true);
    },
  };
  const lastMailTo = (to: string) =>
    [...outbox].reverse().find((m) => m.to === to);

  beforeAll(async () => {
    process.env.DATA_DIR = 'memory://';
    if (!process.env.TEST_DATABASE_URL) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.JWT_SECRET = 'test-secret';
    process.env.FRONTEND_URL = 'https://site.test';
    process.env.BOARD_ACCOUNTS = `boss@test.dev:${hashSync('s3cret!!', 4)}`;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(fakeMail)
      .compile();
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

    it('emails the club about new messages, safely escaped, with reply-to', async () => {
      await http()
        .post('/api/contact')
        .send({
          name: 'Eve <script>',
          email: 'eve@example.com',
          message: 'Hello <b>club</b>',
        })
        .expect(201);
      const m = lastMailTo('club@test.dev')!;
      expect(m.replyTo).toContain('eve@example.com');
      expect(m.html).not.toContain('<script>');
      expect(m.html).toContain('&#60;b&#62;club');
      expect(m.text).toContain('Hello <b>club</b>');
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

    it('validates and saves the profile', async () => {
      const base = {
        name: 'Board Person',
        phone: '+20 100 123 4567',
        birthday: '2003-05-14',
        gender: 'female',
      };
      const bad = async (patch: object, msg: RegExp) => {
        const r = await http()
          .patch('/api/auth/me')
          .set(bearer(board))
          .send({ ...base, ...patch })
          .expect(400);
        expect(JSON.stringify(r.body)).toMatch(msg);
      };
      expect((await me(board)).profile.complete).toBe(false);
      await bad({ phone: 'call me' }, /phone/);
      await bad({ birthday: '2003-02-30' }, /birthday/);
      await bad({ birthday: '2030-01-01' }, /birthday/);
      await bad({ gender: 'robot' }, /gender/);
      await bad({ linkedinUrl: 'https://example.com/me' }, /LinkedIn link/);
      await bad({ facebookUrl: 'twitter.com/x' }, /Facebook link/);
      const ok = await http()
        .patch('/api/auth/me')
        .set(bearer(board))
        .send({
          ...base,
          linkedinUrl: 'linkedin.com/in/board-person',
          facebookUrl: '',
          portfolioUrl: 'board.dev',
        })
        .expect(200);
      const profile = (ok.body as Me).profile;
      expect(profile).toMatchObject({
        phone: '+20 100 123 4567',
        birthday: '2003-05-14',
        gender: 'female',
        linkedinUrl: 'https://linkedin.com/in/board-person',
        facebookUrl: null,
        portfolioUrl: 'https://board.dev/',
        avatarUrl: null,
        complete: true,
      });
    });

    it('uploads, serves and removes a profile photo', async () => {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64',
      );
      await http()
        .post('/api/auth/me/avatar')
        .set(bearer(board))
        .attach('file', Buffer.from('not really an image'), 'evil.png')
        .expect(400);
      const up = await http()
        .post('/api/auth/me/avatar')
        .set(bearer(board))
        .attach('file', png, 'me.png')
        .expect(201);
      const url = (up.body as { avatarUrl: string }).avatarUrl;
      expect(url).toMatch(/^\/users\/[0-9a-f-]+\/avatar\?v=1$/);
      const img = await http().get(`/api${url}`).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
      expect(Buffer.compare(img.body as Buffer, png)).toBe(0);
      // Visible to people who can view members
      const list = await http()
        .get('/api/members')
        .set(bearer(president))
        .expect(200);
      const mine = (
        list.body as { email: string; profile: { avatarUrl: string } }[]
      ).find((m) => m.email === 'board@test.dev');
      expect(mine?.profile.avatarUrl).toBe(url);
      await http().delete('/api/auth/me/avatar').set(bearer(board)).expect(204);
      await http().get(`/api${url}`).expect(404);
    });

    it('lets members change their own password', async () => {
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

    it('sends forgot-password emails without revealing who has an account', async () => {
      const ask = (email: string) =>
        http().post('/api/auth/forgot-password').send({ email }).expect(200);
      const before = outbox.length;
      const a = await ask('nobody@test.dev');
      expect(outbox.length).toBe(before); // no mail for unknown emails...
      const b = await ask('Board@test.dev');
      expect((b.body as { message: string }).message).toBe(
        (a.body as { message: string }).message, // ...but the same reply
      );
      const mail = lastMailTo('board@test.dev')!;
      expect(mail.subject).toMatch(/Reset/);
      const link = /https:\/\/site\.test\/set-password\/\S+/.exec(
        mail.text,
      )![0];
      await http()
        .post(`/api/auth/links/${link.split('/').pop()}`)
        .send({ password: 'forgot-flow-pass' })
        .expect(200);
      board = await login('board@test.dev', 'forgot-flow-pass');
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
        .send({ email: 'board@test.dev', password: 'forgot-flow-pass' })
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

  describe('team hierarchy (seasons)', () => {
    type Pos = {
      id: string;
      parentId: string | null;
      title: string;
      members: {
        id: string;
        name: string;
        userId: string | null;
        imageUrl: string | null;
      }[];
    };
    type Tree = {
      season: { id: string; number: number; status: string };
      positions: Pos[];
    };
    const admin = (path: string) => `/api/admin${path}`;

    it('ships Season 26 as a read-only archive matching the original page', async () => {
      const list = await http().get('/api/seasons').expect(200);
      const body = list.body as {
        seasons: { number: number; status: string }[];
        defaultNumber: number;
      };
      expect(body.seasons).toEqual([
        expect.objectContaining({ number: 26, status: 'archived' }),
      ]);
      expect(body.defaultNumber).toBe(26);
      const t = (await http().get('/api/seasons/26/hierarchy').expect(200))
        .body as Tree;
      expect(t.positions.map((p) => p.title).sort()).toEqual([
        'General Vice President',
        'Non-Technical Director',
        'President',
        'Technical Director',
        'Vice President Non-Technical',
        'Vice President Technical',
      ]);
      const gvp = t.positions.find(
        (p) => p.title === 'General Vice President',
      )!;
      expect(gvp.members.map((m) => m.name)).toEqual([
        'Ahmed Essam',
        'Seif Eldeen',
      ]);
      expect(t.positions[0].members[0]).toMatchObject({
        name: 'Youssif Saad',
        imageUrl: '/images/team/youssef.jpeg',
        userId: null,
      });
      // archived seasons can't be edited
      await http()
        .post(admin(`/seasons/${t.season.id}/positions`))
        .set(bearer(president))
        .send({ title: 'Extra' })
        .expect(400);
    });

    it('lets only people with the permission build hierarchies', async () => {
      const m = await login('member@test.dev', 'password123');
      await http().get(admin('/seasons')).set(bearer(m)).expect(403);
      await http()
        .post(admin('/seasons'))
        .set(bearer(m))
        .send({ number: 99 })
        .expect(403);
    });

    it('builds Season 27 as a hidden draft, only with real accounts, then publishes it', async () => {
      const s26 = (await http().get('/api/seasons/26/hierarchy')).body as Tree;
      const created = await http()
        .post(admin('/seasons'))
        .set(bearer(president))
        .send({ number: 27, copyFromSeasonId: s26.season.id })
        .expect(201);
      const s27 = created.body as { id: string; status: string };
      expect(s27.status).toBe('draft');
      await http()
        .post(admin('/seasons'))
        .set(bearer(president))
        .send({ number: 27 })
        .expect(409);

      // structure copied, people not
      let t = (
        await http()
          .get(admin(`/seasons/${s27.id}/hierarchy`))
          .set(bearer(president))
          .expect(200)
      ).body as Tree;
      expect(t.positions).toHaveLength(6);
      expect(t.positions.every((p) => p.members.length === 0)).toBe(true);
      // drafts are not public
      await http().get('/api/seasons/27/hierarchy').expect(404);

      const top = t.positions.find((p) => !p.parentId)!;
      const meId = (await me(president)).id;
      const people = (
        await http()
          .get(admin('/seasons/people'))
          .set(bearer(president))
          .expect(200)
      ).body as {
        id: string;
        name: string;
        avatarUrl: string | null;
        linkedinUrl: string | null;
      }[];
      const mine = people.find((x) => x.id === meId)!;
      expect(typeof mine.name).toBe('string');
      expect(mine.avatarUrl).toBeNull();
      expect(mine.linkedinUrl).toBeNull();
      const allMembers = (
        await http().get('/api/members').set(bearer(president))
      ).body as {
        id: string;
        status: string;
      }[];
      const disabledIds = allMembers
        .filter((x) => x.status === 'disabled')
        .map((x) => x.id);
      expect(disabledIds.length).toBeGreaterThan(0);
      // disabled accounts are never offered in the picker
      expect(people.some((x) => disabledIds.includes(x.id))).toBe(false);
      // constraint: only real, active accounts
      await http()
        .post(admin(`/positions/${top.id}/members`))
        .set(bearer(president))
        .send({ userId: '11111111-1111-4111-8111-111111111111' })
        .expect(400);
      const disabled = (
        (await http().get('/api/members').set(bearer(president))).body as {
          id: string;
          status: string;
        }[]
      ).find((x) => x.status === 'disabled')!;
      await http()
        .post(admin(`/positions/${top.id}/members`))
        .set(bearer(president))
        .send({ userId: disabled.id })
        .expect(400);
      await http()
        .post(admin(`/positions/${top.id}/members`))
        .set(bearer(president))
        .send({ userId: meId })
        .expect(204);
      await http()
        .post(admin(`/positions/${top.id}/members`))
        .set(bearer(president))
        .send({ userId: meId })
        .expect(409);

      // add a new sub-position, rename, reorder, delete a branch
      const extra = (
        await http()
          .post(admin(`/seasons/${s27.id}/positions`))
          .set(bearer(president))
          .send({ title: 'Head of Media', parentId: top.id })
          .expect(201)
      ).body as { id: string };
      await http()
        .patch(admin(`/positions/${extra.id}`))
        .set(bearer(president))
        .send({ title: 'Media Head' })
        .expect(204);
      await http()
        .post(admin(`/positions/${extra.id}/move`))
        .set(bearer(president))
        .send({ direction: 'up' })
        .expect(204);
      t = (
        await http()
          .get(admin(`/seasons/${s27.id}/hierarchy`))
          .set(bearer(president))
      ).body as Tree;
      const kids = t.positions
        .filter((p) => p.parentId === top.id)
        .map((p) => p.title);
      expect(kids).toEqual(['Media Head', 'General Vice President']);
      const gvp = t.positions.find(
        (p) => p.title === 'General Vice President',
      )!;
      await http()
        .delete(admin(`/positions/${gvp.id}`))
        .set(bearer(president))
        .expect(204);
      t = (
        await http()
          .get(admin(`/seasons/${s27.id}/hierarchy`))
          .set(bearer(president))
      ).body as Tree;
      expect(t.positions.map((p) => p.title).sort()).toEqual([
        'Media Head',
        'President',
      ]);

      // not on a published season yet -> no public profile
      await http().get(`/api/people/${meId}`).expect(404);

      // publish: 27 becomes the default, 26 stays as history
      await http()
        .post(admin(`/seasons/${s27.id}/publish`))
        .set(bearer(president))
        .expect(204);
      const list = (await http().get('/api/seasons')).body as {
        seasons: { number: number; status: string }[];
        defaultNumber: number;
      };
      expect(list.defaultNumber).toBe(27);
      expect(list.seasons.map((x) => `${x.number}:${x.status}`)).toEqual([
        '27:current',
        '26:archived',
      ]);
      const pub = (await http().get('/api/seasons/27/hierarchy').expect(200))
        .body as Tree;
      expect(pub.positions.find((p) => !p.parentId)!.members[0]).toMatchObject({
        userId: meId,
        imageUrl: null,
      });
      await http()
        .delete(admin(`/seasons/${s27.id}`))
        .set(bearer(president))
        .expect(400);
    });
  });
});
