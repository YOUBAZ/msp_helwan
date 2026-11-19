import type { JwtService } from '@nestjs/jwt';

/**
 * Short-lived token that lets the dashboard show photos of hidden albums in
 * plain <img> tags (which can't send a login header).
 */
const HOUR = 3600;

/**
 * The token is identical for the same photo within an hour-long window (no
 * issued-at time, expiry rounded up), so dashboard photo URLs don't change on
 * every reload and browsers can cache the thumbnails. Valid 1 to 2 hours.
 */
export function signPhotoToken(jwt: JwtService, itemId: string) {
  const now = Math.floor(Date.now() / 1000);
  const windowEnd = (Math.floor(now / HOUR) + 2) * HOUR;
  // exp = now + (windowEnd - now) = windowEnd: the same for the whole window.
  return jwt.signAsync(
    { media: itemId },
    { noTimestamp: true, expiresIn: windowEnd - now },
  );
}

export async function verifyPhotoToken(
  jwt: JwtService,
  token: string | undefined,
  itemId: string,
): Promise<boolean> {
  if (!token) return false;
  try {
    const payload = await jwt.verifyAsync<{ media?: string }>(token);
    return payload.media === itemId;
  } catch {
    return false;
  }
}
