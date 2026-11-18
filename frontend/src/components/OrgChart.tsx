/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Linkedin } from "@/components/BrandIcons";
import { apiUrl } from "@/lib/api";
import { childrenByParent } from "@/lib/hierarchy";
import type { HierarchyMember, HierarchyPosition } from "@/lib/types";

const SIZES = {
  large: "w-44 h-44 md:w-52 md:h-52",
  medium: "w-36 h-36 md:w-44 md:h-44",
  small: "w-28 h-28 md:w-36 md:h-36",
};
const sizeFor = (depth: number): keyof typeof SIZES =>
  depth === 0 ? "large" : depth <= 2 ? "medium" : "small";

function Wrap({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  return href ? (
    <Link
      href={href}
      aria-label={label}
      className="block hover:text-orange-600"
    >
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}

function MemberCard({
  member,
  title,
  size,
}: {
  member: HierarchyMember;
  title: string;
  size: keyof typeof SIZES;
}) {
  const photo = member.avatarUrl ? apiUrl(member.avatarUrl) : member.imageUrl;
  // Account holders have a profile page; people from before accounts don't.
  const profileHref = member.userId ? `/people/${member.userId}` : null;
  const initials = member.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex flex-col items-center group z-10 relative">
      <Wrap href={profileHref} label={`View ${member.name}'s profile`}>
        <div
          className={`relative ${SIZES[size]} rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white transition-all duration-500 group-hover:scale-105 group-hover:shadow-orange-500/20`}
        >
          {photo ? (
            <img
              src={photo}
              alt={member.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-900 to-orange-600 text-white font-black text-4xl flex items-center justify-center">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-60" />
        </div>
      </Wrap>
      <div className="mt-4 text-center px-2 max-w-[13rem]">
        <Wrap href={profileHref} label={`View ${member.name}'s profile`}>
          <h3
            className={`${
              size === "small" ? "text-sm md:text-lg" : "text-base md:text-xl"
            } font-black text-slate-900 uppercase tracking-tighter leading-tight`}
          >
            {member.name}
          </h3>
        </Wrap>
        <p className="text-[8px] md:text-[10px] font-bold text-orange-600 uppercase tracking-widest">
          {title}
        </p>
        {member.linkedinUrl && (
          <a
            href={member.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`${member.name} on LinkedIn`}
            className="inline-block mt-2 text-slate-400 hover:text-blue-700 transition-colors"
          >
            <Linkedin
              size={18}
              fill="currentColor"
              className="text-white bg-blue-700 rounded-sm p-0.5"
            />
          </a>
        )}
      </div>
    </div>
  );
}

function PositionNode({
  position,
  depth,
  kidsOf,
}: {
  position: HierarchyPosition;
  depth: number;
  kidsOf: (id: string | null) => HierarchyPosition[];
}) {
  const kids = kidsOf(position.id);
  return (
    <div className="flex flex-col items-center">
      {position.members.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-6 md:gap-12">
          {position.members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              title={position.title}
              size={sizeFor(depth)}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 text-[10px] font-black uppercase tracking-widest">
          {position.title} · to be announced
        </div>
      )}
      {kids.length > 0 && (
        <>
          <div
            className={`w-1 h-8 md:h-10 mt-4 ${
              depth === 0
                ? "bg-gradient-to-b from-orange-600 to-slate-200"
                : "bg-slate-200"
            }`}
          />
          <div className="flex flex-col md:flex-row md:items-start md:justify-center">
            {kids.map((k, i) => (
              <div
                key={k.id}
                className="relative flex flex-col items-center pt-8 md:px-6"
              >
                {kids.length > 1 && (
                  <div
                    className={`hidden md:block absolute top-0 h-1 bg-slate-200 ${
                      i === 0
                        ? "left-1/2 right-0"
                        : i === kids.length - 1
                          ? "left-0 right-1/2"
                          : "left-0 right-0"
                    }`}
                  />
                )}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-8 bg-slate-200" />
                <PositionNode position={k} depth={depth + 1} kidsOf={kidsOf} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The season's hierarchy as an org chart (stacks vertically on phones). */
export default function OrgChart({
  positions,
}: {
  positions: HierarchyPosition[];
}) {
  const kidsOf = childrenByParent(positions);
  const roots = kidsOf(null);
  return (
    <div className="overflow-x-auto pb-4">
      <div className="min-w-fit mx-auto flex flex-col md:flex-row md:items-start md:justify-center gap-16">
        {roots.map((r) => (
          <PositionNode key={r.id} position={r} depth={0} kidsOf={kidsOf} />
        ))}
      </div>
    </div>
  );
}
