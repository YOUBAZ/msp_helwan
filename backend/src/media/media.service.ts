import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { sniffImage } from '../access/profile';
import { DB, type Database } from '../db/database';
import { mediaAlbums, mediaBlobs, mediaItems } from '../db/schema';
import { signPhotoToken, verifyPhotoToken } from './photo-token';
import { parseVideoLink } from './video-links';

type AlbumRow = typeof mediaAlbums.$inferSelect;
type ItemRow = typeof mediaItems.$inferSelect;

export type MediaPhoto = {
  full: string;
  small: string;
  origin: 'site' | 'api';
};
export type MediaItem = {
  id: string;
  kind: 'photo' | 'video';
  photo?: MediaPhoto;
  video?: {
    provider: 'youtube' | 'facebook' | 'drive';
    embedUrl: string;
    thumbnailUrl: string | null;
    sourceUrl: string;
  };
};
export type MediaAlbum = {
  id: string;
  title: string;
  category: string;
  eventDate: string | null;
  published: boolean;
  items: MediaItem[];
};
export type UploadedFile = { buffer: Buffer; size: number };

const DEFAULT_BUDGET = 400 * 1024 * 1024;
const MAX_FILE = 2 * 1024 * 1024;
const FULL_MESSAGE =
  'Media storage is full: remove photos or move to a bigger storage plan.';

@Injectable()
export class MediaService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------- Reading ----------

  /** Albums for the public page: published, not empty, in manual order. */
  async publicAlbums(): Promise<MediaAlbum[]> {
    const albums = await this.albums(false);
    return albums.filter((a) => a.published && a.items.length > 0);
  }

  /** Every album for the dashboard; photo URLs carry a viewing token. */
  adminAlbums(): Promise<MediaAlbum[]> {
    return this.albums(true);
  }

  private async albums(withTokens: boolean): Promise<MediaAlbum[]> {
    const albums = await this.db
      .select()
      .from(mediaAlbums)
      .orderBy(asc(mediaAlbums.sortOrder), desc(mediaAlbums.createdAt));
    if (!albums.length) return [];
    const items = await this.db
      .select()
      .from(mediaItems)
      .where(
        inArray(
          mediaItems.albumId,
          albums.map((a) => a.id),
        ),
      )
      .orderBy(asc(mediaItems.sortOrder), asc(mediaItems.createdAt));
    return Promise.all(
      albums.map(async (a) =>
        this.serializeAlbum(
          a,
          await Promise.all(
            items
              .filter((i) => i.albumId === a.id)
              .map((i) => this.serializeItem(i, withTokens)),
          ),
        ),
      ),
    );
  }

  private serializeAlbum(a: AlbumRow, items: MediaItem[]): MediaAlbum {
    return {
      id: a.id,
      title: a.title,
      category: a.category,
      eventDate: a.eventDate,
      published: a.published,
      items,
    };
  }

  private async serializeItem(
    i: ItemRow,
    withToken: boolean,
  ): Promise<MediaItem> {
    if (i.kind === 'video') {
      return {
        id: i.id,
        kind: 'video',
        video: {
          provider: i.videoProvider!,
          embedUrl: i.embedUrl!,
          thumbnailUrl: i.thumbnailUrl,
          sourceUrl: i.sourceUrl!,
        },
      };
    }
    if (i.legacyPath) {
      return {
        id: i.id,
        kind: 'photo',
        photo: { full: i.legacyPath, small: i.legacyPath, origin: 'site' },
      };
    }
    const q = withToken ? `?t=${await signPhotoToken(this.jwt, i.id)}` : '';
    return {
      id: i.id,
      kind: 'photo',
      photo: {
        full: `/media/photos/${i.id}/full${q}`,
        small: `/media/photos/${i.id}/small${q}`,
        origin: 'api',
      },
    };
  }

  /**
   * A stored photo. Public only when its album is published; otherwise only
   * with a valid dashboard token. Anything else looks like "not found".
   */
  async photo(itemId: string, variant: string, token?: string) {
    if (variant !== 'full' && variant !== 'small')
      throw new NotFoundException();
    const [row] = await this.db
      .select({
        mime: mediaBlobs.mime,
        data: mediaBlobs.data,
        published: mediaAlbums.published,
      })
      .from(mediaBlobs)
      .innerJoin(mediaItems, eq(mediaItems.id, mediaBlobs.itemId))
      .innerJoin(mediaAlbums, eq(mediaAlbums.id, mediaItems.albumId))
      .where(
        and(eq(mediaBlobs.itemId, itemId), eq(mediaBlobs.variant, variant)),
      );
    if (!row) throw new NotFoundException();
    if (row.published && !token) return { ...row, cache: 'public' as const };
    if (await verifyPhotoToken(this.jwt, token, itemId)) {
      return { ...row, cache: 'private' as const };
    }
    if (row.published) return { ...row, cache: 'public' as const };
    throw new NotFoundException();
  }

  async usage() {
    const [r] = await this.db
      .select({ used: sql<string | number | null>`sum(${mediaBlobs.bytes})` })
      .from(mediaBlobs);
    return { usedBytes: Number(r.used ?? 0), budgetBytes: this.budget() };
  }

  private budget() {
    const v = Number(this.config.get<string>('MEDIA_BUDGET_BYTES'));
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_BUDGET;
  }

  async categories(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ c: mediaAlbums.category })
      .from(mediaAlbums)
      .orderBy(asc(mediaAlbums.category));
    return rows.map((r) => r.c);
  }

  // ---------- Albums ----------

  private async album(id: string) {
    const [a] = await this.db
      .select()
      .from(mediaAlbums)
      .where(eq(mediaAlbums.id, id));
    if (!a) throw new NotFoundException('Album not found.');
    return a;
  }

  /** One album with its items, for the editor (photo URLs carry a token). */
  async adminAlbum(id: string): Promise<MediaAlbum> {
    const album = await this.album(id);
    const items = await this.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.albumId, id))
      .orderBy(asc(mediaItems.sortOrder), asc(mediaItems.createdAt));
    return this.serializeAlbum(
      album,
      await Promise.all(items.map((i) => this.serializeItem(i, true))),
    );
  }

  /** New albums are hidden and go to the top of the list. */
  async createAlbum(dto: {
    title: string;
    category: string;
    eventDate?: string;
  }) {
    const [r] = await this.db
      .select({ min: sql<number | null>`min(${mediaAlbums.sortOrder})` })
      .from(mediaAlbums);
    const [a] = await this.db
      .insert(mediaAlbums)
      .values({
        title: dto.title,
        category: dto.category,
        eventDate: dto.eventDate ? checkDate(dto.eventDate) : null,
        sortOrder: (r.min ?? 1) - 1,
      })
      .returning();
    return this.serializeAlbum(a, []);
  }

  async updateAlbum(
    id: string,
    dto: {
      title?: string;
      category?: string;
      eventDate?: string | null;
      published?: boolean;
    },
  ) {
    await this.album(id);
    await this.db
      .update(mediaAlbums)
      .set({
        title: dto.title,
        category: dto.category,
        eventDate:
          dto.eventDate === undefined
            ? undefined
            : dto.eventDate && checkDate(dto.eventDate),
        published: dto.published,
        updatedAt: new Date(),
      })
      .where(eq(mediaAlbums.id, id));
    return this.adminAlbum(id);
  }

  async moveAlbum(id: string, direction: 'up' | 'down') {
    await this.album(id);
    const all = await this.db
      .select({ id: mediaAlbums.id })
      .from(mediaAlbums)
      .orderBy(asc(mediaAlbums.sortOrder), desc(mediaAlbums.createdAt));
    await reorder(
      all.map((a) => a.id),
      id,
      direction,
      (aid, order) =>
        this.db
          .update(mediaAlbums)
          .set({ sortOrder: order })
          .where(eq(mediaAlbums.id, aid)),
    );
  }

  async deleteAlbum(id: string) {
    await this.album(id);
    await this.db.delete(mediaAlbums).where(eq(mediaAlbums.id, id));
  }

  // ---------- Items ----------

  private async nextItemOrder(albumId: string) {
    const [r] = await this.db
      .select({ max: sql<number | null>`max(${mediaItems.sortOrder})` })
      .from(mediaItems)
      .where(eq(mediaItems.albumId, albumId));
    return (r.max ?? -1) + 1;
  }

  async addPhoto(albumId: string, full?: UploadedFile, small?: UploadedFile) {
    await this.album(albumId);
    if (!full?.buffer?.length || !small?.buffer?.length) {
      throw new BadRequestException(
        'Upload both a full and a small version of the photo.',
      );
    }
    const files = [
      { variant: 'full' as const, file: full },
      { variant: 'small' as const, file: small },
    ].map(({ variant, file }) => {
      if (file.size > MAX_FILE) {
        throw new PayloadTooLargeException(
          'Each photo must be smaller than 2 MB.',
        );
      }
      const mime = sniffImage(file.buffer);
      if (!mime)
        throw new BadRequestException('Please upload JPG, PNG or WebP images.');
      return { variant, mime, data: file.buffer, bytes: file.size };
    });
    const { usedBytes, budgetBytes } = await this.usage();
    if (usedBytes + full.size + small.size > budgetBytes) {
      throw new PayloadTooLargeException(FULL_MESSAGE);
    }
    const sortOrder = await this.nextItemOrder(albumId);
    const item = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(mediaItems)
        .values({ albumId, kind: 'photo', sortOrder })
        .returning();
      await tx
        .insert(mediaBlobs)
        .values(files.map((f) => ({ itemId: row.id, ...f })));
      return row;
    });
    return this.serializeItem(item, true);
  }

  async addVideo(albumId: string, url: string) {
    await this.album(albumId);
    const v = parseVideoLink(url);
    const [item] = await this.db
      .insert(mediaItems)
      .values({
        albumId,
        kind: 'video',
        sortOrder: await this.nextItemOrder(albumId),
        videoProvider: v.provider,
        embedUrl: v.embedUrl,
        thumbnailUrl: v.thumbnailUrl,
        sourceUrl: v.sourceUrl,
      })
      .returning();
    return this.serializeItem(item, true);
  }

  private async item(id: string) {
    const [i] = await this.db
      .select()
      .from(mediaItems)
      .where(eq(mediaItems.id, id));
    if (!i) throw new NotFoundException('Item not found.');
    return i;
  }

  async moveItem(id: string, direction: 'up' | 'down') {
    const item = await this.item(id);
    const siblings = await this.db
      .select({ id: mediaItems.id })
      .from(mediaItems)
      .where(eq(mediaItems.albumId, item.albumId))
      .orderBy(asc(mediaItems.sortOrder), asc(mediaItems.createdAt));
    await reorder(
      siblings.map((s) => s.id),
      id,
      direction,
      (sid, order) =>
        this.db
          .update(mediaItems)
          .set({ sortOrder: order })
          .where(eq(mediaItems.id, sid)),
    );
  }

  async deleteItem(id: string) {
    await this.item(id);
    await this.db.delete(mediaItems).where(eq(mediaItems.id, id));
  }
}

/** Reject impossible dates like 2026-02-30. */
function checkDate(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Please enter a valid date.');
  }
  return value;
}

/** Swap an item with its neighbour and renumber the list 0..n-1. */
async function reorder(
  ids: string[],
  id: string,
  direction: 'up' | 'down',
  save: (id: string, order: number) => Promise<unknown>,
) {
  const i = ids.indexOf(id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [order, sid] of ids.entries()) await save(sid, order);
}
