import type { ConfigService } from '@nestjs/config';

/** Public website address used in emailed links (no trailing slash). */
export function frontendUrl(config: ConfigService): string {
  return (
    config.get<string>('FRONTEND_URL') ??
    (config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3001').split(',')[0]
  )
    .trim()
    .replace(/\/+$/, '');
}
