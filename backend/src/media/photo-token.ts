import type { JwtService } from '@nestjs/jwt';

/**
 * Short-lived token that lets the dashboard show photos of hidden albums in
 * plain <img> tags (which can't send a login header).
 */
export function signPhotoToken(jwt: JwtService, itemId: string) {
  return jwt.signAsync({ media: itemId }, { expiresIn: '1h' });
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
