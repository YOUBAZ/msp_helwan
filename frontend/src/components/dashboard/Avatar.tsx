/* eslint-disable @next/next/no-img-element */
import { apiUrl } from "@/lib/api";

const sizes = {
  sm: "w-10 h-10 text-sm rounded-xl",
  md: "w-14 h-14 text-lg rounded-2xl",
  lg: "w-32 h-32 text-4xl rounded-[2rem]",
};

/** Profile photo, or the person's initials if they haven't uploaded one. */
export default function Avatar({
  name,
  url,
  size = "sm",
  className = "",
}: {
  name: string;
  url: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return url ? (
    <img
      src={apiUrl(url)}
      alt={name}
      className={`${sizes[size]} object-cover shrink-0 bg-slate-100 ${className}`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${sizes[size]} shrink-0 bg-gradient-to-br from-blue-900 to-orange-600 text-white font-black flex items-center justify-center ${className}`}
    >
      {initials || "?"}
    </div>
  );
}
