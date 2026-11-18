import type { Metadata } from "next";
import AccentBar from "@/components/AccentBar";
import MediaGallery from "@/components/MediaGallery";
import { API_URL } from "@/lib/api";
import type { MediaAlbum } from "@/lib/types";

export const metadata: Metadata = { title: "Media Gallery" };

async function loadAlbums(): Promise<MediaAlbum[] | null> {
  try {
    // Always fresh: newly published albums must appear immediately.
    const res = await fetch(`${API_URL}/media/albums`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as MediaAlbum[]) : null;
  } catch {
    return null;
  }
}

export default async function MediaPage() {
  const albums = await loadAlbums();
  return (
    <section className="py-24 bg-white min-h-screen">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase italic">
            Visual Legacy
          </h2>
          <AccentBar className="mb-6" />
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.4em]">
            Capturing the essence of innovation
          </p>
        </div>
        {!albums ? (
          <p className="text-center text-slate-500 font-bold">
            The gallery couldn&apos;t be loaded right now. Please try again later.
          </p>
        ) : albums.length === 0 ? (
          <p className="text-center text-slate-500 font-bold">
            No albums yet. Check back after our next event!
          </p>
        ) : (
          <MediaGallery albums={albums} />
        )}
      </div>
    </section>
  );
}
