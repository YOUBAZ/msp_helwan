import { BadRequestException } from '@nestjs/common';

export type VideoLink = {
  provider: 'youtube' | 'facebook' | 'drive';
  /** The only URL ever placed in an iframe. Built by us, never user text. */
  embedUrl: string;
  thumbnailUrl: string | null;
  /** The normalised link the editor pasted (https). */
  sourceUrl: string;
};

const UNSUPPORTED = 'Paste a YouTube, Facebook or Google Drive video link.';
const YT_ID = /^[\w-]{11}$/;

const hostIs = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

function youtube(id: string | null | undefined, sourceUrl: string): VideoLink {
  if (!id || !YT_ID.test(id)) throw new BadRequestException(UNSUPPORTED);
  return {
    provider: 'youtube',
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    sourceUrl,
  };
}

/**
 * Recognise a YouTube, Facebook or Google Drive video link and turn it into
 * a safe embed URL. Anything else is refused.
 */
export function parseVideoLink(raw: string): VideoLink {
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    throw new BadRequestException(UNSUPPORTED);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new BadRequestException(UNSUPPORTED);
  }
  url.protocol = 'https:';
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split('/').filter(Boolean);
  const sourceUrl = url.toString();

  if (host === 'youtu.be') return youtube(parts[0], sourceUrl);
  if (hostIs(host, 'youtube.com')) {
    if (parts[0] === 'watch')
      return youtube(url.searchParams.get('v'), sourceUrl);
    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
      return youtube(parts[1], sourceUrl);
    }
    throw new BadRequestException(UNSUPPORTED);
  }

  const isFacebookVideo =
    (host === 'fb.watch' && parts.length > 0) ||
    (hostIs(host, 'facebook.com') &&
      (parts.includes('videos') ||
        (parts[0] === 'watch' && !!url.searchParams.get('v')) ||
        parts[0] === 'reel'));
  if (isFacebookVideo) {
    return {
      provider: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(sourceUrl)}&show_text=false`,
      thumbnailUrl: null,
      sourceUrl,
    };
  }

  if (host === 'drive.google.com' && parts[0] === 'file' && parts[1] === 'd') {
    const id = parts[2];
    if (!id || !/^[\w-]+$/.test(id)) throw new BadRequestException(UNSUPPORTED);
    return {
      provider: 'drive',
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      thumbnailUrl: null,
      sourceUrl,
    };
  }

  throw new BadRequestException(UNSUPPORTED);
}
