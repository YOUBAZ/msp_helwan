import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import {
  type Committee,
  nonTechnicalCommittees,
  technicalCommittees,
} from "@/data/committees";

export const metadata: Metadata = { title: "Committees" };

function CommitteeCard({ item }: { item: Committee }) {
  const Icon = item.icon;
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
      <p className="text-slate-400 mb-6 leading-relaxed italic text-sm">
        &quot;{item.description}&quot;
      </p>
      <div className="space-y-3 border-t border-white/5 pt-6 mt-auto">
        {item.tasks.map((task) => (
          <div key={task} className="flex items-start gap-3 text-sm font-medium text-slate-300">
            <CircleCheck size={16} className="text-orange-600 shrink-0 mt-0.5" />
            <span>{task}</span>
          </div>
        ))}
      </div>
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
          <CommitteeCard key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
}

export default function CommitteesPage() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase">
            Our Specialized Squads
          </h2>
          <AccentBar />
        </div>
        <div className="space-y-28">
          <Group title="Technical Committees" border="border-orange-600" items={technicalCommittees} />
          <Group
            title="Non-Technical Committees"
            border="border-blue-900"
            items={nonTechnicalCommittees}
          />
        </div>
      </div>
    </section>
  );
}
