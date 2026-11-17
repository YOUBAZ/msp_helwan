import type { Metadata } from "next";
import AccentBar from "@/components/AccentBar";
import MediaGallery from "@/components/MediaGallery";

export const metadata: Metadata = { title: "Media Gallery" };

export default function MediaPage() {
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
        <MediaGallery />
      </div>
    </section>
  );
}
