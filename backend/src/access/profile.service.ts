import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/database';
import { userAvatars, users } from '../db/schema';
import type { UpdateMeDto } from './dto';
import { checkBirthday, checkLink, profileOf, sniffImage } from './profile';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

@Injectable()
export class ProfileService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async update(userId: string, dto: UpdateMeDto) {
    const [u] = await this.db
      .update(users)
      .set({
        name: dto.name,
        phone: dto.phone,
        birthday: checkBirthday(dto.birthday),
        gender: dto.gender,
        linkedinUrl: checkLink(dto.linkedinUrl, 'LinkedIn', 'linkedin'),
        facebookUrl: checkLink(dto.facebookUrl, 'Facebook', 'facebook'),
        portfolioUrl: checkLink(dto.portfolioUrl, 'Portfolio'),
      })
      .where(eq(users.id, userId))
      .returning();
    return profileOf(u);
  }

  async setAvatar(userId: string, file?: { buffer: Buffer; size: number }) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Please choose an image.');
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException('The image must be smaller than 2 MB.');
    }
    const mime = sniffImage(file.buffer);
    if (!mime)
      throw new BadRequestException('Please upload a JPG, PNG or WebP image.');
    return this.db.transaction(async (tx) => {
      await tx
        .insert(userAvatars)
        .values({ userId, mime, data: file.buffer })
        .onConflictDoUpdate({
          target: userAvatars.userId,
          set: { mime, data: file.buffer, updatedAt: new Date() },
        });
      const [u] = await tx
        .update(users)
        .set({ avatarVersion: sql`${users.avatarVersion} + 1` })
        .where(eq(users.id, userId))
        .returning();
      return { avatarUrl: profileOf(u).avatarUrl };
    });
  }

  async removeAvatar(userId: string) {
    await this.db.transaction(async (tx) => {
      await tx.delete(userAvatars).where(eq(userAvatars.userId, userId));
      await tx
        .update(users)
        .set({ avatarVersion: 0 })
        .where(eq(users.id, userId));
    });
  }

  async getAvatar(userId: string) {
    const [a] = await this.db
      .select()
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId));
    if (!a) throw new NotFoundException();
    return a;
  }
}
