import { BadRequestException } from '@nestjs/common';
import type { users } from '../db/schema';

type UserRow = typeof users.$inferSelect;

export type Profile = {
  phone: string | null;
  birthday: string | null;
  gender: 'male' | 'female' | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  portfolioUrl: string | null;
  /** Path relative to the API base, or null if no photo. */
  avatarUrl: string | null;
  /** True once the required fields (phone, birthday, gender) are filled. */
  complete: boolean;
};

export function profileOf(u: UserRow): Profile {
  return {
    phone: u.phone,
    birthday: u.birthday,
    gender: u.gender,
    linkedinUrl: u.linkedinUrl,
    facebookUrl: u.facebookUrl,
    portfolioUrl: u.portfolioUrl,
    avatarUrl:
      u.avatarVersion > 0 ? `/users/${u.id}/avatar?v=${u.avatarVersion}` : null,
    complete: !!(u.phone && u.birthday && u.gender),
  };
}

/** Validate a birthday 'YYYY-MM-DD': a real date, age 10–100. */
export function checkBirthday(value: string) {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Please enter a valid birthday.');
  }
  const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (age < 10 || age > 100) {
    throw new BadRequestException('Please enter a valid birthday.');
  }
  return value;
}

const SITES = {
  linkedin: { hosts: ['linkedin.com'], name: 'LinkedIn' },
  facebook: { hosts: ['facebook.com', 'fb.com'], name: 'Facebook' },
} as const;

/**
 * Normalize an optional profile link: '' -> null, adds https:// if missing,
 * and checks it points to the right site.
 */
export function checkLink(
  raw: string | null | undefined,
  label: string,
  site?: keyof typeof SITES,
): string | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new BadRequestException(`${label}: please enter a valid link.`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname.includes('.')
  ) {
    throw new BadRequestException(`${label}: please enter a valid link.`);
  }
  if (site) {
    const host = url.hostname.toLowerCase();
    const ok = SITES[site].hosts.some(
      (h) => host === h || host.endsWith(`.${h}`),
    );
    if (!ok) {
      throw new BadRequestException(
        `${label}: must be a ${SITES[site].name} link.`,
      );
    }
  }
  url.protocol = 'https:';
  return url.toString();
}

/** Detect image type from the file's first bytes (don't trust the browser). */
export function sniffImage(
  buf: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length > 8 &&
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
