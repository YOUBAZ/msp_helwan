import type { Metadata } from "next";
import Link from "next/link";
import OrgChart from "@/components/OrgChart";
import { API_URL } from "@/lib/api";
import type { HierarchyTree, Season } from "@/lib/types";

export const metadata: Metadata = { title: "Our Team" };

async function get<T>(path: string): Promise<T | null> {
  try {
    // Always fresh: a newly published season must show up immediately.
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: requested } = await searchParams;
  const list = await get<{ seasons: Season[]; defaultNumber: number | null }>("/seasons");
  const seasons = list?.seasons ?? [];
  const number =
    requested && seasons.some((s) => String(s.number) === requested)
      ? Number(requested)
      : list?.defaultNumber;
  const tree = number != null ? await get<HierarchyTree>(`/seasons/${number}/hierarchy`) : null;

  return (
    <section className="py-12 md:py-24 bg-slate-50 min-h-screen font-sans overflow-hidden">
      <div className="container mx-auto px-4">
        {seasons.length > 1 && (
          <nav aria-label="Seasons" className="flex flex-wrap justify-center gap-2 mb-10">
            {seasons.map((s) => (
              <Link
                key={s.id}
                href={`/team?season=${s.number}`}
                aria-current={s.number === number ? "page" : undefined}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  s.number === number
                    ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                    : "bg-white text-slate-600 hover:text-orange-600"
                }`}
              >
                {s.name}
                {s.status === "current" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-600 text-white text-[8px]">
                    Current
                  </span>
                )}
              </Link>
            ))}
          </nav>
        )}

        <div className="text-center mb-16 md:mb-24">
          <span className="px-4 py-1 bg-blue-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
            {tree ? `${tree.season.name} Hierarchy` : "Hierarchy"}
          </span>
          <h2 className="text-4xl md:text-6xl font-black text-slate-900 mt-4 tracking-tighter uppercase italic leading-none">
            High Board
          </h2>
        </div>

        {!tree ? (
          <p className="text-center text-slate-500 font-bold">
            The team hierarchy couldn&apos;t be loaded right now. Please try again later.
          </p>
        ) : tree.positions.length === 0 ? (
          <p className="text-center text-slate-500 font-bold">
            The {tree.season.name} hierarchy is being prepared. Check back soon!
          </p>
        ) : (
          <OrgChart positions={tree.positions} />
        )}
      </div>
    </section>
  );
}
