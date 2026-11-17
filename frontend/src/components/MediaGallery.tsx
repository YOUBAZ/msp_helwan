"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from "lucide-react";
import { albums } from "@/data/events";

export default function MediaGallery() {
  const [frames, setFrames] = useState(() => albums.map(() => 0));
  const [album, setAlbum] = useState<number | null>(null);
  const [index, setIndex] = useState(0);

  // Each card cycles through its album once per second, like the original.
  useEffect(() => {
    const id = setInterval(() => {
      setFrames((f) => f.map((v, i) => (v + 1) % albums[i].images.length));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const open = (i: number) => {
    setAlbum(i);
    setIndex(0);
    document.body.style.overflow = "hidden";
  };
  const close = useCallback(() => {
    setAlbum(null);
    document.body.style.overflow = "unset";
  }, []);
  const count = album !== null ? albums[album].images.length : 0;
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(() => setIndex((i) => (i === 0 ? count - 1 : i - 1)), [count]);

  useEffect(() => {
    if (album === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [album, close, next, prev]);

  useEffect(() => () => void (document.body.style.overflow = "unset"), []);

  return (
    <>
      <div className="grid md:grid-cols-2 gap-8">
        {albums.map((a, i) => (
          <div
            key={a.title}
            className="group relative bg-[#0f172a] rounded-[2rem] overflow-hidden shadow-xl border border-slate-800 transition-all duration-500 hover:shadow-orange-600/10"
          >
            <button
              type="button"
              aria-label={`Open ${a.title} album`}
              className="relative block w-full h-72 sm:h-96 overflow-hidden cursor-pointer"
              onClick={() => open(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.images[frames[i]]}
                alt={a.title}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105 opacity-90 group-hover:opacity-100"
              />
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
            <div className="p-6 flex items-center justify-between border-t border-white/5">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-black text-white uppercase tracking-tight italic">
                  {a.title}
                </h3>
              </div>
              <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0">
                <ImageIcon size={14} className="text-orange-500" />
                {a.images.length} Photos
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preload album images so the slideshow doesn't flash */}
      <div hidden>
        {albums.flatMap((a) =>
          a.images.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" />
          )),
        )}
      </div>

      {album !== null && (
        <div
          role="dialog"
          aria-modal="true"
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
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-0 md:left-4 p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-[110]"
            >
              <ChevronLeft size={40} />
            </button>
            <div className="relative flex flex-col items-center justify-center w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={index}
                src={albums[album].images[index]}
                alt="Full View"
                className="max-w-full max-h-[80vh] md:max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
              />
              <div className="mt-6 text-center space-y-2">
                <p className="text-white font-black uppercase tracking-widest text-sm">
                  {albums[album].title}
                </p>
                <p className="text-orange-500 font-bold text-[10px] uppercase tracking-[0.4em]">
                  Image {index + 1} of {count}
                </p>
              </div>
            </div>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-0 md:right-4 p-4 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all z-[110]"
            >
              <ChevronRight size={40} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
