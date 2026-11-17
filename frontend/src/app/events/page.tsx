import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calendar, History, MapPin, PanelsTopLeft, Sparkles } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import { pastEvents, upcomingEvents } from "@/data/events";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <section className="py-24 bg-white min-h-screen">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">
            Impact &amp; Events
          </h2>
          <AccentBar className="mb-6" />
          <p className="text-slate-500 font-medium max-w-xl mx-auto italic">
            &quot;Relive our success stories and stay tuned for the upcoming milestones.&quot;
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7 space-y-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-orange-100 rounded-2xl text-orange-600">
                <Sparkles size={24} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                Upcoming Milestones
              </h3>
            </div>
            <div className="space-y-8">
              {upcomingEvents.map((ev) => (
                <div
                  key={ev.title}
                  className="group relative bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl hover:shadow-orange-500/10 transition-all border-l-8 border-l-orange-600"
                >
                  {ev.isLive && (
                    <span className="absolute -top-4 right-8 bg-green-500 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest animate-pulse">
                      Live Now
                    </span>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3 text-slate-400 text-sm font-bold">
                      <Calendar size={18} className="text-orange-600" />
                      {ev.date}
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 text-sm font-bold">
                      <MapPin size={18} className="text-orange-600" />
                      {ev.location}
                    </div>
                  </div>
                  <h4 className="text-2xl font-black text-blue-900 mb-4 uppercase">{ev.title}</h4>
                  <p className="text-slate-600 leading-relaxed mb-8 text-sm font-medium italic">
                    &quot;{ev.desc}&quot;
                  </p>
                  <button className="flex items-center gap-2 bg-blue-900 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg group-hover:-translate-y-1">
                    See Details <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-blue-100 rounded-2xl text-blue-900">
                <History size={24} />
              </div>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
                Our Legacy
              </h3>
            </div>
            <div className="relative border-l-2 border-slate-100 ml-4 space-y-12 pb-8">
              {pastEvents.map((ev) => (
                <div key={ev.title} className="relative pl-10 group">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 bg-slate-200 rounded-full border-4 border-white group-hover:bg-blue-900 group-hover:scale-150 transition-all" />
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                      {ev.date}
                    </span>
                    <h4 className="text-lg font-black text-slate-800 group-hover:text-blue-900 transition-colors uppercase leading-tight">
                      {ev.title}
                    </h4>
                    <p className="text-slate-500 text-xs leading-relaxed max-w-sm">{ev.desc}</p>
                    <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                      <PanelsTopLeft size={12} /> {ev.achievement}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-8 bg-slate-900 rounded-[2rem] text-center">
              <h5 className="text-white font-black uppercase text-sm mb-2">More in our Gallery</h5>
              <p className="text-slate-400 text-xs mb-6">Check out the memories we captured.</p>
              <Link
                href="/media"
                className="block w-full py-4 bg-orange-600 text-white rounded-xl font-black uppercase text-xs tracking-widest hover:bg-white hover:text-orange-600 transition-all shadow-lg"
              >
                View Gallery
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
