import type { Metadata } from "next";
import { Clock, Rocket } from "lucide-react";
import { Linkedin } from "@/components/BrandIcons";
import {
  type Member,
  generalVPs,
  nonTechnicalDirectors,
  president,
  technicalDirectors,
  wingVPs,
} from "@/data/team";

export const metadata: Metadata = { title: "Our Team" };

const sizes = {
  large: "w-44 h-44 md:w-52 md:h-52",
  medium: "w-36 h-36 md:w-44 md:h-44",
  small: "w-28 h-28 md:w-36 md:h-36",
};

function MemberCard({ member, size }: { member: Member; size: keyof typeof sizes }) {
  return (
    <div className="flex flex-col items-center group z-10 relative">
      <div
        className={`relative ${sizes[size]} rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white transition-all duration-500 group-hover:scale-105 group-hover:shadow-orange-500/20`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={member.image} alt={member.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60" />
      </div>
      <div className="mt-4 text-center px-2">
        <h3
          className={`${
            size === "small" ? "text-sm md:text-lg" : "text-base md:text-xl"
          } font-black text-slate-900 uppercase tracking-tighter leading-tight`}
        >
          {member.name}
        </h3>
        <p className="text-[8px] md:text-[10px] font-bold text-orange-600 uppercase tracking-widest">
          {member.role}
        </p>
        <a
          href={member.linkedin}
          target="_blank"
          rel="noreferrer"
          aria-label={`${member.name} on LinkedIn`}
          className="inline-block mt-2 text-slate-400 hover:text-blue-700 transition-colors"
        >
          <Linkedin size={18} fill="currentColor" className="text-white bg-blue-700 rounded-sm p-0.5" />
        </a>
      </div>
    </div>
  );
}

function ComingSoonCard({ title, accent }: { title: string; accent: "blue" | "orange" }) {
  const c =
    accent === "blue"
      ? { border: "border-blue-900", bg: "bg-blue-50 text-blue-900", text: "text-blue-600" }
      : { border: "border-orange-600", bg: "bg-orange-50 text-orange-600", text: "text-orange-600" };
  return (
    <div className="relative group">
      <div
        className={`bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-xl border-t-8 ${c.border} text-center transform transition-transform group-hover:-translate-y-2`}
      >
        <div
          className={`w-12 h-12 md:w-16 md:h-16 ${c.bg} rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse`}
        >
          <Clock size={32} />
        </div>
        <h4 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter">
          {title}
        </h4>
        <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-widest">
          Heads &amp; Vices Selection
        </p>
        <div
          className={`mt-6 flex items-center justify-center gap-2 ${c.text} font-black text-xs md:text-sm`}
        >
          <Rocket size={18} className="animate-bounce" /> UNDER CONSTRUCTION
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <section className="py-12 md:py-24 bg-slate-50 min-h-screen font-sans overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16 md:mb-24">
          <span className="px-4 py-1 bg-blue-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
            Season 26 Hierarchy
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 mt-4 tracking-tighter uppercase italic leading-none">
            High Board
          </h2>
        </div>

        {/* President */}
        <div className="flex flex-col items-center mb-1 relative">
          <MemberCard member={president} size="large" />
          <div className="w-1 h-12 md:h-16 bg-gradient-to-b from-orange-600 to-slate-200 mt-4" />
        </div>

        {/* General VPs */}
        <div className="relative mb-1">
          <div className="hidden md:block absolute top-0 left-1/4 right-1/4 h-1 bg-slate-200" />
          <div className="flex flex-col md:flex-row justify-center items-center md:items-start gap-12 md:gap-40 max-w-5xl mx-auto md:pt-8">
            {generalVPs.map((m) => (
              <div key={m.name} className="flex flex-col items-center relative">
                <div className="hidden md:block absolute -top-8 w-1 h-8 bg-slate-200" />
                <MemberCard member={m} size="medium" />
                <div className="w-1 h-12 md:h-16 bg-slate-200 mt-4" />
              </div>
            ))}
          </div>
        </div>

        {/* Wing VPs + directors */}
        <div className="relative mb-1">
          <div className="hidden md:block absolute top-0 left-1/4 right-1/4 h-1 bg-slate-200" />
          <div className="flex flex-col md:flex-row justify-around items-center md:items-start max-w-6xl mx-auto md:pt-8 gap-16 md:gap-0">
            {wingVPs.map((vp, i) => (
              <div key={vp.name} className="flex flex-col items-center relative w-full">
                <div className="hidden md:block absolute -top-8 w-1 h-8 bg-slate-200" />
                <MemberCard member={vp} size="medium" />
                <div className="w-1 h-12 md:h-16 bg-slate-200 mt-4" />
                <div className="relative w-full">
                  <div className="hidden md:block absolute top-0 left-1/4 right-1/4 h-0.5 bg-slate-200" />
                  <div className="flex flex-row justify-center gap-4 md:gap-12 pt-8 px-2">
                    {(i === 0 ? technicalDirectors : nonTechnicalDirectors).map((d) => (
                      <div key={d.name} className="flex flex-col items-center relative">
                        <div className="hidden md:block absolute -top-8 w-0.5 h-8 bg-slate-200" />
                        <MemberCard member={d} size="small" />
                        <div className="w-0.5 h-12 md:h-16 bg-gradient-to-b from-slate-200 to-slate-300 mt-4" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-5xl mx-auto mt-8">
          <ComingSoonCard title="Technical Board" accent="blue" />
          <ComingSoonCard title="Non-Technical Board" accent="orange" />
        </div>
      </div>
    </section>
  );
}
