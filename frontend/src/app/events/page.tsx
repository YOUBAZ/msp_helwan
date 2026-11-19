import type { Metadata } from "next";
import Link from "next/link";
import { Award, Images, Radio, Sparkles, Users } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import EventCard from "@/components/events/EventCard";
import { formatCairo } from "@/lib/events";
import { fetchEvents } from "@/lib/events-api";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const lists = await fetchEvents();
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

        {!lists ? (
          <p className="text-center text-slate-500 font-bold">
            Events couldn&apos;t be loaded right now. Please try again later.
          </p>
        ) : (
          <div className="grid lg:grid-cols-12 gap-16">
            <div className="lg:col-span-7 space-y-10">
              {lists.live.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-green-100 rounded-2xl text-green-700">
                      <Radio size={24} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Happening now</h3>
                  </div>
                  <div className="space-y-8">
                    {lists.live.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-orange-100 rounded-2xl text-orange-600">
                    <Sparkles size={24} />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Upcoming Milestones</h3>
                </div>
                {lists.upcoming.length === 0 ? (
                  <div className="p-8 rounded-[2.5rem] bg-slate-50 text-slate-500 font-medium">
                    No upcoming events right now. Follow us on social media so you don&apos;t miss the next one!
                  </div>
                ) : (
                  <div className="space-y-8">
                    {lists.upcoming.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-blue-100 rounded-2xl text-blue-900">
                  <Award size={24} />
                </div>
                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Our Legacy</h3>
              </div>
              <div className="relative border-l-2 border-slate-100 ml-4 space-y-12 pb-8">
                {lists.past.map((e) => (
                  <div key={e.id} className="relative pl-10 group">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-slate-200 rounded-full border-4 border-white group-hover:bg-blue-900 group-hover:scale-150 transition-all" />
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
                        {formatCairo(e.startsAt, "short")}
                      </span>
                      <h4 className="text-lg font-black text-slate-800 group-hover:text-blue-900 transition-colors uppercase leading-tight">
                        <Link href={`/events/${e.id}`} className="hover:underline">
                          {e.title}
                        </Link>
                      </h4>
                      {e.description && (
                        <p className="text-slate-500 text-xs leading-relaxed max-w-sm">{e.description}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {e.attendance !== null && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                            <Users size={12} /> {e.attendance} attended
                          </span>
                        )}
                        {e.highlight && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-tighter">
                            <Award size={12} /> {e.highlight}
                          </span>
                        )}
                        {e.mediaAlbumId && (
                          <Link
                            href="/media"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-lg text-[10px] font-black uppercase tracking-tighter hover:bg-orange-100"
                          >
                            <Images size={12} /> See the photos
                          </Link>
                        )}
                      </div>
                      {e.partners.length > 0 && (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">
                          With {e.partners.join(", ")}
                        </p>
                      )}
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
        )}
      </div>
    </section>
  );
}
