import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
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

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

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

  describe('media', () => {
    type Photo = { full: string; small: string; origin: 'site' | 'api' };
    type Item = {
      id: string;
      kind: 'photo' | 'video';
      photo?: Photo;
      video?: {
        provider: string;
        embedUrl: string;
        thumbnailUrl: string | null;
      };
    };
    type Album = {
      id: string;
      title: string;
      category: string;
      eventDate: string | null;
      published: boolean;
      items: Item[];
    };
    const publicAlbums = async () =>
      (await http().get('/api/media/albums').expect(200)).body as Album[];

    it('keeps the 4 original albums but no photos pointing at deleted files', async () => {
      // The original photos were imported into production and their files
      // deleted; a fresh database keeps the albums (empty, so not public).
      const admin = (
        await http()
          .get('/api/admin/media/albums')
          .set(bearer(president))
          .expect(200)
      ).body as Album[];
      expect(admin.map((a) => a.title)).toEqual([
        'Orientation Day 2025',
        'AI Catalyst 2025',
        'Problem Solving Competition 2025',
        'Best Heads & Members 2025',
      ]);
      expect(admin.every((a) => a.items.length === 0)).toBe(true);
      expect(await publicAlbums()).toEqual([]);
    });

    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const A = (path: string) => `/api/admin/media${path}`;
    const newAlbum = async (title: string, category = 'Hackathon') =>
      (
        await http()
          .post(A('/albums'))
          .set(bearer(president))
          .send({ title, category })
          .expect(201)
      ).body as Album;
    const uploadPhoto = (albumId: string, file = PNG) =>
      http()
        .post(A(`/albums/${albumId}/photos`))
        .set(bearer(president))
        .attach('full', file, 'full.png')
        .attach('small', file, 'small.png');
    const adminAlbum = async (id: string) =>
      (
        (await http().get(A('/albums')).set(bearer(president)).expect(200))
          .body as Album[]
      ).find((a) => a.id === id)!;

    it('requires media.manage', async () => {
      const m = await login('member@test.dev', 'password123');
      await http().get(A('/albums')).set(bearer(m)).expect(403);
      await http()
        .post(A('/albums'))
        .set(bearer(m))
        .send({ title: 'X album', category: 'Event' })
        .expect(403);
    });

    it('creates a hidden album at the top and publishes it', async () => {
      const album = await newAlbum('Hackathon 2026');
      expect(album.published).toBe(false);
      expect((await publicAlbums()).some((a) => a.id === album.id)).toBe(false);
      const item = (await uploadPhoto(album.id).expect(201)).body as Item;
      expect(item.kind).toBe('photo');
      await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({ published: true })
        .expect(200);
      const first = (await publicAlbums())[0];
      expect(first.id).toBe(album.id);
      expect(first.items[0].photo?.origin).toBe('api');
      expect(first.items[0].photo?.full).toBe(`/media/photos/${item.id}/full`);
    });

    it('hides photos of hidden albums', async () => {
      const album = await newAlbum('Secret album');
      const item = (await uploadPhoto(album.id).expect(201)).body as Item;
      await http().get(`/api/media/photos/${item.id}/full`).expect(404);
      const tokenUrl = (await adminAlbum(album.id)).items[0].photo!.full;
      expect(tokenUrl).toMatch(/\?t=/);
      const viaToken = await http().get(`/api${tokenUrl}`).expect(200);
      expect(viaToken.headers['content-type']).toBe('image/png');
      expect(viaToken.headers['cache-control']).toContain('private');
      await http()
        .get(`/api/media/photos/${item.id}/full?t=forged`)
        .expect(404);
      await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({ published: true })
        .expect(200);
      const pub = await http()
        .get(`/api/media/photos/${item.id}/small`)
        .expect(200);
      expect(pub.headers['cache-control']).toContain('max-age=3600');
      expect(Buffer.compare(pub.body as Buffer, PNG)).toBe(0);
    });

    it('only accepts tokens made for photos', async () => {
      const album = await newAlbum('Audience album');
      const item = (await uploadPhoto(album.id).expect(201)).body as Item;
      // Same secret, right item, but not marked as a photo token.
      const generic = await new JwtService({ secret: 'test-secret' }).signAsync(
        {
          media: item.id,
        },
      );
      await http()
        .get(`/api/media/photos/${item.id}/full?t=${generic}`)
        .expect(404);
      const real = (await adminAlbum(album.id)).items[0].photo!.full;
      await http().get(`/api${real}`).expect(200);
    });

    it('rejects non-images and oversized files', async () => {
      const album = await newAlbum('Validation album');
      await uploadPhoto(album.id, Buffer.from('not an image at all')).expect(
        400,
      );
      const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024 + 1)]);
      const r = await uploadPhoto(album.id, big);
      expect([400, 413]).toContain(r.status);
      await http()
        .post(A(`/albums/${album.id}/photos`))
        .set(bearer(president))
        .attach('full', PNG, 'full.png')
        .expect(400); // small version missing
    });

    it('adds video links', async () => {
      const album = await newAlbum('Video album');
      const v = (
        await http()
          .post(A(`/albums/${album.id}/videos`))
          .set(bearer(president))
          .send({ url: 'https://youtu.be/dQw4w9WgXcQ' })
          .expect(201)
      ).body as Item;
      expect(v.video).toMatchObject({
        provider: 'youtube',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      });
      await http()
        .post(A(`/albums/${album.id}/videos`))
        .set(bearer(president))
        .send({ url: 'https://vimeo.com/1' })
        .expect(400);
    });

    it('reorders and deletes', async () => {
      const before = (await publicAlbums()).map((a) => a.title);
      const second = (await publicAlbums())[1];
      await http()
        .post(A(`/albums/${second.id}/move`))
        .set(bearer(president))
        .send({ direction: 'up' })
        .expect(204);
      const after = (await publicAlbums()).map((a) => a.title);
      expect(after.slice(0, 2)).toEqual([before[1], before[0]]);

      const album = await newAlbum('Order album');
      const p1 = (await uploadPhoto(album.id).expect(201)).body as Item;
      const p2 = (await uploadPhoto(album.id).expect(201)).body as Item;
      await http()
        .post(A(`/items/${p2.id}/move`))
        .set(bearer(president))
        .send({ direction: 'up' })
        .expect(204);
      expect((await adminAlbum(album.id)).items.map((i) => i.id)).toEqual([
        p2.id,
        p1.id,
      ]);
      await http()
        .delete(A(`/items/${p1.id}`))
        .set(bearer(president))
        .expect(204);
      expect((await adminAlbum(album.id)).items.map((i) => i.id)).toEqual([
        p2.id,
      ]);
      await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({ published: true })
        .expect(200);
      await http()
        .delete(A(`/albums/${album.id}`))
        .set(bearer(president))
        .expect(204);
      await http().get(`/api/media/photos/${p2.id}/full`).expect(404);
      expect(await adminAlbum(album.id)).toBeUndefined();
    });

    it('hides emptied albums publicly', async () => {
      const album = await newAlbum('Soon empty');
      const item = (await uploadPhoto(album.id).expect(201)).body as Item;
      await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({ published: true })
        .expect(200);
      expect((await publicAlbums()).some((a) => a.id === album.id)).toBe(true);
      await http()
        .delete(A(`/items/${item.id}`))
        .set(bearer(president))
        .expect(204);
      expect((await publicAlbums()).some((a) => a.id === album.id)).toBe(false);
    });

    it('edits album details and validates them', async () => {
      const album = await newAlbum('Typo albm');
      const r = await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({
          title: 'Fixed album',
          category: 'Event',
          eventDate: '2026-03-01',
        })
        .expect(200);
      expect(r.body).toMatchObject({
        title: 'Fixed album',
        category: 'Event',
        eventDate: '2026-03-01',
      });
      await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({ eventDate: null })
        .expect(200);
      await http()
        .patch(A(`/albums/${album.id}`))
        .set(bearer(president))
        .send({ title: 'x' })
        .expect(400);
    });

    it('refuses uploads over the media budget', async () => {
      const usage = (
        await http().get(A('/usage')).set(bearer(president)).expect(200)
      ).body as { usedBytes: number; budgetBytes: number };
      expect(usage.usedBytes).toBeGreaterThan(0);
      expect(usage.budgetBytes).toBe(400 * 1024 * 1024);
      const album = await newAlbum('Budget album');
      process.env.MEDIA_BUDGET_BYTES = String(usage.usedBytes + 100);
      try {
        const r = await uploadPhoto(album.id).expect(413);
        expect(JSON.stringify(r.body)).toContain('Media storage is full');
      } finally {
        delete process.env.MEDIA_BUDGET_BYTES;
      }
      await uploadPhoto(album.id).expect(201);
    });

    it('keeps dashboard photo URLs stable so browsers can cache them', async () => {
      const album = await newAlbum('Stable urls');
      await uploadPhoto(album.id).expect(201);
      const first = (await adminAlbum(album.id)).items[0].photo!.full;
      await new Promise((r) => setTimeout(r, 1100));
      const second = (await adminAlbum(album.id)).items[0].photo!.full;
      expect(second).toBe(first);
      const res = await http().get(`/api${first}`).expect(200);
      expect(res.headers['cache-control']).toMatch(/^private, max-age=\d+$/);
    });

    it('returns a single album for the editor', async () => {
      const album = await newAlbum('Single album');
      await uploadPhoto(album.id).expect(201);
      const one = (
        await http()
          .get(A(`/albums/${album.id}`))
          .set(bearer(president))
          .expect(200)
      ).body as Album;
      expect(one).toMatchObject({ id: album.id, title: 'Single album' });
      expect(one.items).toHaveLength(1);
      await http()
        .get(A('/albums/00000000-0000-4000-8000-000000000000'))
        .set(bearer(president))
        .expect(404);
    });

    it('never lets two simultaneous uploads overshoot the budget', async () => {
      const album = await newAlbum('Race album');
      const { usedBytes } = (
        await http().get(A('/usage')).set(bearer(president)).expect(200)
      ).body as { usedBytes: number };
      // Room for exactly one photo (full + small = 2 x PNG).
      process.env.MEDIA_BUDGET_BYTES = String(usedBytes + PNG.length * 2 + 10);
      try {
        const results = await Promise.all([
          uploadPhoto(album.id),
          uploadPhoto(album.id),
        ]);
        expect(results.map((r) => r.status).sort()).toEqual([201, 413]);
      } finally {
        delete process.env.MEDIA_BUDGET_BYTES;
      }
    });

    it('applies simultaneous moves one after the other', async () => {
      const album = await newAlbum('Move race album');
      const ids: string[] = [];
      for (let k = 0; k < 4; k++) {
        ids.push(((await uploadPhoto(album.id).expect(201)).body as Item).id);
      }
      const last = ids[3];
      const moveUp = () =>
        http()
          .post(A(`/items/${last}/move`))
          .set(bearer(president))
          .send({ direction: 'up' })
          .expect(204);
      await Promise.all([moveUp(), moveUp()]);
      const order = (await adminAlbum(album.id)).items.map((i) => i.id);
      expect(order.indexOf(last)).toBe(1);
      expect([...order].sort()).toEqual([...ids].sort());
    });

    it('lists categories', async () => {
      const cats = (
        await http().get(A('/categories')).set(bearer(president)).expect(200)
      ).body as string[];
      expect(cats).toEqual(
        expect.arrayContaining([
          'Awards',
          'Contest',
          'Event',
          'Hackathon',
          'Workshop',
        ]),
      );
      expect([...cats].sort()).toEqual(cats);
    });
  });

  describe('events', () => {
    type Ev = {
      id: string;
      title: string;
      phase: 'upcoming' | 'live' | 'past';
      registration: 'open' | 'waitlist' | 'closed';
      attendance: number | null;
      coverUrl: string | null;
      confirmed: number;
      waitlisted: number;
      cancelled: boolean;
      published?: boolean;
    };
    type EventLists = { upcoming: Ev[]; live: Ev[]; past: Ev[] };
    const E = (path = '') => `/api/admin/events${path}`;
    const inHours = (h: number) =>
      new Date(Date.now() + h * 3600 * 1000).toISOString();
    const lists = async () =>
      (await http().get('/api/events').expect(200)).body as EventLists;
    const createEvent = async (fields: Record<string, unknown> = {}) =>
      (
        await http()
          .post(E())
          .set(bearer(president))
          .send({
            title: 'Test Event',
            category: 'Workshop',
            startsAt: inHours(48),
            ...fields,
          })
          .expect(201)
      ).body as Ev;
    const publish = (id: string, extra: Record<string, unknown> = {}) =>
      http()
        .patch(E(`/${id}`))
        .set(bearer(president))
        .send({ published: true, venue: 'Hall A', ...extra })
        .expect(200);

    it('seeds the 4 past events', async () => {
      const l = await lists();
      expect(l.past.map((e) => e.title)).toEqual([
        'Season Orientation 2026',
        'AI Catalyst with Dotpy 2025',
        'Battery Tech with Schneider Electric 2025',
        'Orientation Day 2025',
      ]);
      expect(
        l.past.find((e) => e.title.startsWith('AI Catalyst'))!.attendance,
      ).toBe(200);
      expect(l.upcoming).toEqual([]);
      expect(l.past.every((e) => e.registration === 'closed')).toBe(true);
    });

    it('requires events.manage', async () => {
      const m = await login('member@test.dev', 'password123');
      await http().get(E()).set(bearer(m)).expect(403);
      await http()
        .post(E())
        .set(bearer(m))
        .send({ title: 'X event', category: 'Workshop', startsAt: inHours(5) })
        .expect(403);
    });

    it('creates a hidden draft and publishes it', async () => {
      const ev = await createEvent({ title: 'Draft Hackathon' });
      expect(ev.published).toBe(false);
      expect((await lists()).upcoming.some((e) => e.id === ev.id)).toBe(false);
      await http().get(`/api/events/${ev.id}`).expect(404);
      await publish(ev.id);
      const up = (await lists()).upcoming.find((e) => e.id === ev.id)!;
      expect(up.registration).toBe('open');
      await http().get(`/api/events/${ev.id}`).expect(200);
    });

    it('computes upcoming/live/past from dates', async () => {
      const live = await createEvent({
        title: 'Live now',
        startsAt: inHours(-1),
      });
      const done = await createEvent({ title: 'Done', startsAt: inHours(-4) });
      await publish(live.id);
      await publish(done.id);
      const l = await lists();
      expect(l.live.map((e) => e.id)).toContain(live.id);
      expect(l.past.map((e) => e.id)).toContain(done.id);
      expect(l.live.find((e) => e.id === live.id)!.registration).toBe('closed');
    });

    it('uploads a cover counted in the media budget', async () => {
      const ev = await createEvent({ title: 'Covered' });
      const before = (
        (await http().get('/api/admin/media/usage').set(bearer(president)))
          .body as {
          usedBytes: number;
        }
      ).usedBytes;
      await http()
        .post(E(`/${ev.id}/cover`))
        .set(bearer(president))
        .attach('file', Buffer.from('nope'), 'x.png')
        .expect(400);
      const up = await http()
        .post(E(`/${ev.id}/cover`))
        .set(bearer(president))
        .attach('file', PNG_1PX, 'c.png')
        .expect(201);
      const coverUrl = (up.body as Ev).coverUrl!;
      expect(coverUrl).toMatch(new RegExp(`^/events/${ev.id}/cover\\?v=1$`));
      const img = await http().get(`/api${coverUrl}`).expect(200);
      expect(img.headers['content-type']).toBe('image/png');
      const after = (
        (await http().get('/api/admin/media/usage').set(bearer(president)))
          .body as {
          usedBytes: number;
        }
      ).usedBytes;
      expect(after - before).toBe(PNG_1PX.length);
    });

    it('adds the two event permissions', async () => {
      const perms = (
        await http().get('/api/permissions').set(bearer(president)).expect(200)
      ).body as { key: string }[];
      expect(perms.map((p) => p.key)).toEqual(
        expect.arrayContaining(['events.manage', 'events.checkin']),
      );
      const pres = (await roles(president)).find(
        (r) => r.name === 'President',
      )!;
      expect(pres.permissions).toEqual(
        expect.arrayContaining(['events.manage', 'events.checkin']),
      );
    });
  });
});
