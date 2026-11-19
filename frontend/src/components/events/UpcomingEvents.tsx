import Link from "next/link";
import { ArrowRight, Calendar, MapPin } from "lucide-react";
import { formatCairo, registrationLabel } from "@/lib/events";
import { fetchEvents } from "@/lib/events-api";
import Countdown from "./Countdown";

/** Home page: countdown to the next event and up to 3 upcoming events. */
export default async function UpcomingEvents() {
  const lists = await fetchEvents();
  const upcoming = (lists?.upcoming ?? []).filter((e) => !e.cancelled).slice(0, 3);
  const next = upcoming[0];
  return (
    <section className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-black text-blue-900 mb-12 uppercase tracking-tight italic text-center">
          Our Impactful Events
        </h2>
        {!next ? (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 text-center">
            <p className="text-slate-600 font-medium">
              No upcoming events right now. Follow us on social media so you don&apos;t miss the next one.
            </p>
            <Link
              href="/events"
              className="mt-6 inline-flex items-center gap-2 font-black text-xs text-blue-900 uppercase tracking-widest hover:text-orange-600"
            >
              See our past events <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-8">
            <Link
              href={`/events/${next.id}`}
              className="group block bg-blue-900 rounded-[2.5rem] p-8 md:p-10 shadow-2xl text-white"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Next event</p>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mt-3">
                <div>
                  <h3 className="text-3xl md:text-4xl font-black uppercase tracking-tight">{next.title}</h3>
                  <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-blue-100 font-bold text-sm">
                    <span className="flex items-center gap-2">
                      <Calendar size={16} className="text-orange-400" /> {formatCairo(next.startsAt)}
                    </span>
                    <span className="flex items-center gap-2">
                      <MapPin size={16} className="text-orange-400" /> {next.venue}
                    </span>
                  </p>
                </div>
                <Countdown to={next.startsAt} />
              </div>
              <span className="mt-6 inline-flex items-center gap-2 bg-orange-600 group-hover:bg-white group-hover:text-blue-900 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all">
                {next.registration === "open" ? "Register now" : registrationLabel(next)} <ArrowRight size={16} />
              </span>
            </Link>
            {upcoming.length > 1 && (
              <div className="grid md:grid-cols-2 gap-6">
                {upcoming.slice(1).map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="bg-white p-6 rounded-[2rem] shadow-lg border border-slate-100 hover:border-orange-500 transition-all"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">{e.category}</p>
                    <h4 className="text-xl font-black text-blue-900 mt-1">{e.title}</h4>
                    <p className="text-sm text-slate-500 font-bold mt-2">{formatCairo(e.startsAt)}</p>
                  </Link>
                ))}
              </div>
            )}
            <div className="text-center">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 font-black text-xs text-blue-900 uppercase tracking-widest hover:text-orange-600"
              >
                All events <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
