/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, Users } from "lucide-react";
import { coverSrc, formatCairo, registrationLabel, seatsLeft } from "@/lib/events";
import type { PublicEvent } from "@/lib/types";

/** Card for an upcoming or live event. */
export default function EventCard({ event: e }: { event: PublicEvent }) {
  const cover = coverSrc(e);
  const left = seatsLeft(e);
  const badge = e.cancelled
    ? "bg-red-600"
    : e.phase === "live"
      ? "bg-green-500 animate-pulse"
      : e.registration === "open"
        ? "bg-blue-900"
        : e.registration === "waitlist"
          ? "bg-orange-600"
          : "bg-slate-500";
  return (
    <Link
      href={`/events/${e.id}`}
      className="group relative block bg-white border border-slate-100 rounded-[2.5rem] shadow-xl hover:shadow-orange-500/10 transition-all border-l-8 border-l-orange-600 overflow-hidden"
    >
      {cover && (
        <img src={cover} alt="" className="w-full h-44 md:h-52 object-cover group-hover:scale-[1.02] transition-transform" />
      )}
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`${badge} text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>
            {registrationLabel(e)}
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{e.category}</span>
        </div>
        <h4 className={`text-2xl font-black text-blue-900 mb-4 uppercase ${e.cancelled ? "line-through opacity-60" : ""}`}>
          {e.title}
        </h4>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 text-slate-500 text-sm font-bold mb-5">
          <span className="flex items-center gap-2">
            <Calendar size={16} className="text-orange-600" />
            {formatCairo(e.startsAt)}
          </span>
          <span className="flex items-center gap-2">
            <MapPin size={16} className="text-orange-600" />
            {e.venue}
          </span>
          {left !== null && !e.cancelled && e.phase === "upcoming" && (
            <span className="flex items-center gap-2">
              <Users size={16} className="text-orange-600" />
              {left > 0 ? `${left} seat${left === 1 ? "" : "s"} left` : "Full"}
            </span>
          )}
        </div>
        {e.description && (
          <p className="text-slate-600 leading-relaxed mb-6 text-sm font-medium line-clamp-3">{e.description}</p>
        )}
        <span className="inline-flex items-center gap-2 bg-blue-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest group-hover:bg-orange-600 transition-all shadow-lg">
          {e.registration === "open" ? "Register" : e.registration === "waitlist" ? "Join waiting list" : "See details"}
          <ArrowRight size={16} />
        </span>
      </div>
    </Link>
  );
}
