import { BadRequestException } from '@nestjs/common';
import { parseVideoLink } from './video-links';

describe('parseVideoLink', () => {
  const YT_EMBED = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';
  const YT_THUMB = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';

  it.each([
    'youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
    'https://youtu.be/dQw4w9WgXcQ?si=x',
    'm.youtube.com/watch?v=dQw4w9WgXcQ',
    'youtube.com/shorts/dQw4w9WgXcQ',
  ])('recognises YouTube link %s', (url) => {
    expect(parseVideoLink(url)).toEqual(
      expect.objectContaining({
        provider: 'youtube',
        embedUrl: YT_EMBED,
        thumbnailUrl: YT_THUMB,
      }),
    );
  });

  it.each([
    'https://www.facebook.com/msp/videos/1234567890/',
    'facebook.com/watch/?v=1234567890',
    'https://fb.watch/abcDEF/',
  ])('recognises Facebook link %s', (url) => {
    const v = parseVideoLink(url);
    expect(v.provider).toBe('facebook');
    expect(
      v.embedUrl.startsWith('https://www.facebook.com/plugins/video.php?href='),
    ).toBe(true);
    expect(v.embedUrl).toContain(encodeURIComponent(v.sourceUrl));
    expect(v.sourceUrl.startsWith('https://')).toBe(true);
    expect(v.thumbnailUrl).toBeNull();
  });

  it('recognises a Google Drive file link', () => {
    expect(
      parseVideoLink(
        'https://drive.google.com/file/d/1AbC_dEf/view?usp=sharing',
      ),
    ).toEqual(
      expect.objectContaining({
        provider: 'drive',
        embedUrl: 'https://drive.google.com/file/d/1AbC_dEf/preview',
        thumbnailUrl: null,
      }),
    );
  });

  it.each([
    'https://vimeo.com/1',
    'javascript:alert(1)',
    'not a link',
    'https://youtube.com/watch?v=',
    'https://evil.com/youtube.com/watch?v=dQw4w9WgXcQ',
  ])('refuses %s', (url) => {
    expect(() => parseVideoLink(url)).toThrow(BadRequestException);
  });
});
