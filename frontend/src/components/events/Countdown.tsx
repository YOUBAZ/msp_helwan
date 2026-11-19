"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return { days: Math.floor(m / 1440), hours: Math.floor((m % 1440) / 60), minutes: m % 60 };
}

/** Days / hours / minutes until `to`, updated every minute. */
export default function Countdown({ to }: { to: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const p = parts(target - (now ?? target));
  const box = (n: number, label: string) => (
    <div className="bg-white/10 rounded-2xl px-4 py-3 min-w-[72px] text-center">
      <div className="text-3xl md:text-4xl font-black text-white tabular-nums">{now === null ? "–" : n}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-orange-400">{label}</div>
    </div>
  );
  return (
    <div className="flex gap-3" role="timer" aria-label="Time until the event starts">
      {box(p.days, "Days")}
      {box(p.hours, "Hours")}
      {box(p.minutes, "Minutes")}
    </div>
  );
}
