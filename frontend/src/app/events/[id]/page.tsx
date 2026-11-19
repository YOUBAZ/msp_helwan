/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, Calendar, Clock, Images, MapPin, Users } from "lucide-react";
import RegistrationBox from "@/components/events/RegistrationBox";
import { coverSrc, formatCairo, registrationLabel } from "@/lib/events";
import { fetchEvent } from "@/lib/events-api";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = await fetchEvent((await params).id);
  return e ? { title: e.title, description: e.description.slice(0, 160) } : { title: "Event" };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const e = await fetchEvent((await params).id);
  if (!e) notFound();
  const cover = coverSrc(e);
  return (
    <section className="py-12 md:py-20 bg-white min-h-screen">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <Link
          href="/events"
          className="mb-8 inline-flex items-center gap-2 text-slate-400 hover:text-blue-900 transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> All events
        </Link>
        {cover && <img src={cover} alt="" className="w-full max-h-[420px] object-cover rounded-[2.5rem] shadow-2xl mb-10" />}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-blue-900 text-white text-[10px] font-black uppercase tracking-widest">
            {e.category}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              e.cancelled ? "bg-red-100 text-red-700" : "bg-orange-50 text-orange-700"
            }`}
          >
            {registrationLabel(e)}
          </span>
        </div>
        <h1 className={`text-4xl md:text-6xl font-black text-slate-900 tracking-tighter uppercase italic leading-none ${e.cancelled ? "line-through opacity-60" : ""}`}>
          {e.title}
        </h1>
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 mt-10">
          <div className="space-y-6">
            <ul className="space-y-3 text-slate-700 font-bold">
              <li className="flex items-center gap-3">
                <Calendar size={18} className="text-orange-600 shrink-0" /> {formatCairo(e.startsAt, "date")}
              </li>
              <li className="flex items-center gap-3">
                <Clock size={18} className="text-orange-600 shrink-0" /> {formatCairo(e.startsAt, "time")}
                {e.endsAt && ` – ${formatCairo(e.endsAt, "time")}`} (Cairo time)
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={18} className="text-orange-600 shrink-0" /> {e.venue}
              </li>
              {e.phase === "past" && e.attendance !== null && (
                <li className="flex items-center gap-3">
                  <Users size={18} className="text-orange-600 shrink-0" /> {e.attendance} attended
                </li>
              )}
              {e.highlight && (
                <li className="flex items-center gap-3">
                  <Award size={18} className="text-orange-600 shrink-0" /> {e.highlight}
                </li>
              )}
            </ul>
            {e.description && (
              <p className="text-slate-600 leading-relaxed whitespace-pre-line text-lg">{e.description}</p>
            )}
            {e.partners.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">In partnership with</p>
                <div className="flex flex-wrap gap-2">
                  {e.partners.map((p) => (
                    <span key={p} className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700 text-sm">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {e.mediaAlbumId && (
              <Link
                href="/media"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-50 text-orange-700 font-black text-xs uppercase tracking-widest hover:bg-orange-100"
              >
                <Images size={16} /> See the photos
              </Link>
            )}
          </div>
          <div>
            <RegistrationBox initial={e} />
          </div>
        </div>
      </div>
    </section>
  );
}
