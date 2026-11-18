"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Maximize2,
  PlayCircle,
  X,
} from "lucide-react";
import { albumCover, countLabel, photoSrc } from "@/lib/media";
import type { MediaAlbum, MediaItem } from "@/lib/types";

/** Small versions of an album's photos, used by the flipping card cover. */
const coverFrames = (a: MediaAlbum) => {
  const photos = a.items.flatMap((i) => (i.photo ? [photoSrc(i.photo, "small")] : []));
  if (photos.length) return photos;
  const cover = albumCover(a);
  return cover ? [cover] : [];
};

function ViewerItem({ item, title }: { item: MediaItem; title: string }) {
  if (item.video) {
    return (
      <div className="w-full max-w-5xl aspect-video rounded-lg overflow-hidden shadow-2xl bg-black animate-in zoom-in-95 duration-300">
        <iframe
          src={item.video.embedUrl}
          title={`${title} video`}
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoSrc(item.photo!, "full")}
      alt={title}
      className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
    />
  );
}

export default function MediaGallery({ albums }: { albums: MediaAlbum[] }) {
  const categories = useMemo(() => [...new Set(albums.map((a) => a.category))], [albums]);
  const [category, setCategory] = useState<string | null>(null);
  const shown = category ? albums.filter((a) => a.category === category) : albums;

  const frames = useMemo(() => Object.fromEntries(albums.map((a) => [a.id, coverFrames(a)])), [albums]);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<MediaAlbum | null>(null);
  const [index, setIndex] = useState(0);

  // Each card flips to its next photo once per second, like the original page.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const show = (a: MediaAlbum) => {
    setOpen(a);
    setIndex(0);
    document.body.style.overflow = "hidden";
  };
  const close = useCallback(() => {
    setOpen(null);
    document.body.style.overflow = "unset";
  }, []);
  const count = open?.items.length ?? 0;
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i === 0 ? count - 1 : i - 1)), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, prev]);

  useEffect(() => () => void (document.body.style.overflow = "unset"), []);

  const chip = (value: string | null, label: string) => (
    <button
      key={label}
      onClick={() => setCategory(value)}
      aria-pressed={category === value}
      className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
        category === value
          ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
          : "bg-slate-100 text-slate-600 hover:text-orange-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {categories.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10" aria-label="Filter by category">
          {chip(null, "All")}
          {categories.map((c) => chip(c, c))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {shown.map((a) => {
          const f = frames[a.id];
          const src = f.length ? f[tick % f.length] : null;
          return (
            <div
              key={a.id}
              className="group relative bg-[#0f172a] rounded-[2rem] overflow-hidden shadow-xl border border-slate-800 transition-all duration-500 hover:shadow-orange-600/10"
            >
              <button
                type="button"
                aria-label={`Open ${a.title} album`}
                className="relative block w-full h-72 sm:h-96 overflow-hidden cursor-pointer"
                onClick={() => show(a)}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={a.title}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-900 to-orange-600 flex items-center justify-center">
                    <PlayCircle size={64} className="text-white/80" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-transparent to-transparent opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-orange-600 p-4 rounded-full text-white shadow-2xl">
                    <Maximize2 size={24} />
                  </div>
                </div>
                <span className="absolute top-6 left-6 px-4 py-1 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                  {a.category}
                </span>
              </button>
              <div className="p-6 flex items-center justify-between gap-4 border-t border-white/5">
                <h3 className="text-xl font-black text-white uppercase tracking-tight italic">
                  {a.title}
                </h3>
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0">
                  <ImageIcon size={14} className="text-orange-500" />
                  {countLabel(a)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preload photo covers so the flipping doesn't flash */}
      <div hidden>
        {Object.values(frames)
          .flat()
          .map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" />
          ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
          onClick={close}
        >
          <button
            onClick={close}
            aria-label="Close"
            className="absolute top-6 right-6 text-white/50 hover:text-white hover:rotate-90 transition-all z-[120]"
          >
            <X size={32} />
          </button>
          <div
            className="relative w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {count > 1 && (
              <button
                onClick={prev}
                aria-label="Previous"
                className="absolute left-0 md:left-4 p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-[110]"
              >
                <ChevronLeft size={40} />
              </button>
            )}
            <div className="relative flex flex-col items-center justify-center w-full h-full px-10 md:px-20">
              <ViewerItem key={open.items[index].id} item={open.items[index]} title={open.title} />
              <div className="mt-6 text-center space-y-2">
                <p className="text-white font-black uppercase tracking-widest text-sm">{open.title}</p>
                <p className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.4em]">
                  {open.items[index].kind === "video" ? "Video" : "Image"} {index + 1} of {count}
                </p>
              </div>
            </div>
            {count > 1 && (
              <button
                onClick={next}
                aria-label="Next"
                className="absolute right-0 md:right-4 p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-[110]"
              >
                <ChevronRight size={40} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
