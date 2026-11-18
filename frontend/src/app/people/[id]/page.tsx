/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import { Facebook, Linkedin } from "@/components/BrandIcons";
import { API_URL, apiUrl } from "@/lib/api";

type PublicProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  portfolioUrl: string | null;
  positions: { seasonNumber: number; seasonName: string; seasonStatus: string; title: string }[];
};

async function load(id: string): Promise<PublicProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await fetch(`${API_URL}/people/${id}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as PublicProfile) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const p = await load((await params).id);
  return { title: p ? p.name : "Profile" };
}

const pretty = (url: string) => url.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "");

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p) notFound();

  const initials = p.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  const links = [
    p.linkedinUrl && { href: p.linkedinUrl, label: "LinkedIn", Icon: Linkedin },
    p.facebookUrl && { href: p.facebookUrl, label: "Facebook", Icon: Facebook },
    p.portfolioUrl && { href: p.portfolioUrl, label: "Portfolio", Icon: Globe },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof Globe }[];
  const latest = p.positions[0];

  return (
    <section className="py-12 md:py-24 bg-slate-50 min-h-[80vh]">
      <div className="container mx-auto px-4 max-w-3xl">
        <Link
          href={latest ? `/team?season=${latest.seasonNumber}` : "/team"}
          className="mb-8 inline-flex items-center gap-2 text-slate-400 hover:text-blue-900 transition-colors text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> Back to the team
        </Link>

        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden">
          <div className="h-28 md:h-36 bg-gradient-to-r from-blue-900 via-blue-900 to-orange-600" />
          <div className="px-6 md:px-12 pb-10 -mt-16 md:-mt-20 flex flex-col items-center text-center">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl bg-white">
              {p.avatarUrl ? (
                <img src={apiUrl(p.avatarUrl)} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900 to-orange-600 text-white font-black text-4xl flex items-center justify-center">
                  {initials}
                </div>
              )}
            </div>
            <h1 className="mt-5 text-3xl md:text-5xl font-black text-slate-900 uppercase tracking-tighter italic">
              {p.name}
            </h1>
            {latest && (
              <p className="mt-2 text-xs md:text-sm font-black text-orange-600 uppercase tracking-widest">
                {latest.title} · {latest.seasonName}
              </p>
            )}
            <AccentBar size="sm" className="mt-4" />

            {links.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                {links.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-blue-900 font-black text-xs uppercase tracking-widest hover:bg-blue-900 hover:text-white transition-all"
                    title={pretty(href)}
                  >
                    <Icon size={16} /> {label}
                  </a>
                ))}
              </div>
            )}

            <div className="w-full mt-10 text-left">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                MSP Tech Club positions
              </h2>
              <ul className="space-y-3">
                {p.positions.map((pos) => (
                  <li
                    key={`${pos.seasonNumber}-${pos.title}`}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border-l-4 border-orange-600"
                  >
                    <span className="font-black text-blue-900 uppercase tracking-tight">{pos.title}</span>
                    <Link
                      href={`/team?season=${pos.seasonNumber}`}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-orange-600 shrink-0"
                    >
                      {pos.seasonName}
                      {pos.seasonStatus === "current" && " · current"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
