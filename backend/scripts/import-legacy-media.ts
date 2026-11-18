/**
 * One-time import of the original Media page photos into the database.
 *
 *   DATABASE_URL=<production database URL> npm run media:import-legacy
 *
 * The 004_media migration created the original albums with photos that still
 * point at files in frontend/public/images/events. This copies each file into
 * the database (a full and a small version, like new uploads) and switches the
 * photo over. Safe to run more than once: already-imported photos are skipped.
 */
import { asc, eq, isNotNull } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import sharp from 'sharp';
import { openDatabase } from '../src/db/database';
import { mediaBlobs, mediaItems } from '../src/db/schema';

const PUBLIC_DIR = resolve(__dirname, '../../frontend/public');

function version(src: Buffer, maxSide: number, quality: number) {
  return sharp(src)
    .rotate() // respect phone orientation
    .resize({
      width: maxSide,
      height: maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      'Set DATABASE_URL to the database to import into (e.g. your Neon URL).',
    );
    process.exit(1);
  }
  const { db, close } = await openDatabase({ url });
  try {
    const items = await db
      .select()
      .from(mediaItems)
      .where(isNotNull(mediaItems.legacyPath))
      .orderBy(asc(mediaItems.albumId), asc(mediaItems.sortOrder));
    if (!items.length) {
      console.log(
        'Nothing to import: all Media photos are already in the database.',
      );
      return;
    }
    let bytes = 0;
    for (const [n, item] of items.entries()) {
      const file = resolve(PUBLIC_DIR, `.${item.legacyPath}`);
      if (!file.startsWith(PUBLIC_DIR + sep))
        throw new Error(`Unexpected path ${item.legacyPath}`);
      const src = await readFile(file);
      const full = await version(src, 1600, 82);
      const small = await version(src, 600, 80);
      await db.transaction(async (tx) => {
        await tx
          .insert(mediaBlobs)
          .values([
            {
              itemId: item.id,
              variant: 'full',
              mime: 'image/jpeg',
              data: full,
              bytes: full.length,
            },
            {
              itemId: item.id,
              variant: 'small',
              mime: 'image/jpeg',
              data: small,
              bytes: small.length,
            },
          ])
          .onConflictDoNothing();
        await tx
          .update(mediaItems)
          .set({ legacyPath: null })
          .where(eq(mediaItems.id, item.id));
      });
      bytes += full.length + small.length;
      process.stdout.write(
        `\r  ${n + 1}/${items.length} ${item.legacyPath}          `,
      );
    }
    process.stdout.write('\n');
    console.log(
      `Imported ${items.length} photos (${(bytes / 1024 / 1024).toFixed(1)} MB).`,
    );
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Import failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
