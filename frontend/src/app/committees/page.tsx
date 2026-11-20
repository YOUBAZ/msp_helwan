import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import { committeeIcon, fetchCommittees } from "@/lib/committees";
import type { Committee } from "@/lib/types";

export const metadata: Metadata = { title: "Committees" };

function CommitteeCard({ item }: { item: Committee }) {
  const Icon = committeeIcon(item.icon);
  return (
    <div className="bg-[#0f172a] p-8 rounded-[2.5rem] shadow-xl hover:shadow-orange-500/20 transition-all duration-300 hover:-translate-y-2 group flex flex-col h-full border border-slate-800">
      <div className="flex justify-between items-start mb-6">
        <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-orange-600 transition-colors duration-300">
          <Icon size={32} className="text-white" />
        </div>
      </div>
      <h4 className="text-2xl font-bold mb-4 text-white group-hover:text-orange-500 transition-colors tracking-tight">
        {item.name}
      </h4>
      {item.description && (
        <p className="text-slate-400 mb-6 leading-relaxed italic text-sm">&quot;{item.description}&quot;</p>
      )}
      {item.tasks.length > 0 && (
      <div className="space-y-3 border-t border-white/5 pt-6 mt-auto">
        {item.tasks.map((task, i) => (
          <div key={`${i}-${task}`} className="flex items-start gap-3 text-sm font-medium text-slate-300">
            <CircleCheck size={16} className="text-orange-600 shrink-0 mt-0.5" />
            <span>{task}</span>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function Group({
  title,
  border,
  items,
}: {
  title: string;
  border: string;
  items: Committee[];
}) {
  return (
    <div>
      <div className="flex items-center gap-4 mb-12 ml-2">
        <h3
          className={`text-3xl font-bold text-slate-900 uppercase tracking-widest border-l-8 ${border} pl-4`}
        >
          {title}
        </h3>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {items.map((item) => (
          <CommitteeCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default async function CommitteesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season } = await searchParams;
  const asked = Number(season);
  const view = await fetchCommittees(Number.isInteger(asked) && asked > 0 ? asked : undefined);
  const shown = view?.season?.number;
  const technical = view?.committees.filter((c) => c.track === "technical") ?? [];
  const nonTechnical = view?.committees.filter((c) => c.track === "non_technical") ?? [];
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">
            Our Specialized Squads
          </h2>
          <AccentBar />
        </div>

        {view && view.seasons.length > 1 && (
          <nav aria-label="Season" className="flex flex-wrap justify-center gap-2 mb-6">
            {view.seasons.map((s) => (
              <Link
                key={s.number}
                href={`/committees?season=${s.number}`}
                aria-current={s.number === shown ? "page" : undefined}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  s.number === shown
                    ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                    : "bg-slate-100 text-slate-600 hover:text-orange-600"
                }`}
              >
                {s.name}
              </Link>
            ))}
          </nav>
        )}
        {view?.fallback && view.seasons[0] && (
          <p className="text-center text-sm font-bold text-orange-700 mb-6">
            {view.seasons[0].name}&apos;s committees are coming soon. Here are {view.season?.name}&apos;s.
          </p>
        )}

        {!view ? (
          <p className="text-center text-slate-500 font-bold mt-16">
            Committees couldn&apos;t be loaded right now. Please try again later.
          </p>
        ) : view.committees.length === 0 ? (
          <p className="text-center text-slate-500 font-bold mt-16">
            {view.season ? `${view.season.name}'s committees are coming soon.` : "Committees are coming soon."}
          </p>
        ) : (
          <div className="space-y-28 mt-16">
            {technical.length > 0 && (
              <Group title="Technical Committees" border="border-orange-600" items={technical} />
            )}
            {nonTechnical.length > 0 && (
              <Group title="Non-Technical Committees" border="border-blue-900" items={nonTechnical} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
