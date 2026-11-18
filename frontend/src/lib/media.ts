import { apiUrl } from "./api";
import type { MediaAlbum, MediaPhoto } from "./types";

/** Browser-ready address of a photo version. */
export const photoSrc = (p: MediaPhoto, variant: "full" | "small") =>
  p.origin === "api" ? apiUrl(p[variant]) : p[variant];

/** Cover image of an album card: first photo, else a video thumbnail. */
export function albumCover(a: MediaAlbum): string | null {
  const photo = a.items.find((i) => i.photo)?.photo;
  if (photo) return photoSrc(photo, "small");
  return a.items.find((i) => i.video?.thumbnailUrl)?.video?.thumbnailUrl ?? null;
}

/** "12 Photos · 2 Videos", omitting a zero part. */
export function countLabel(a: MediaAlbum) {
  const photos = a.items.filter((i) => i.kind === "photo").length;
  const videos = a.items.length - photos;
  const part = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : "");
  return [part(photos, "Photo"), part(videos, "Video")].filter(Boolean).join(" · ") || "Empty";
}
