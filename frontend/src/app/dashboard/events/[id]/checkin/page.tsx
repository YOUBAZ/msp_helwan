"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Search, XCircle } from "lucide-react";
import QrScanner from "@/components/dashboard/QrScanner";
import { Empty, inputCls } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { formatCairo } from "@/lib/events";
import type { AdminEvent } from "@/lib/types";

type Result = {
  result: "checked_in" | "already" | "waitlisted" | "cancelled" | "wrong_event" | "invalid";
  registration?: { id: string; name: string; status: string; checkedInAt: string | null };
  checkedIn: number;
  confirmed: number;
};
type Person = { id: string; name: string; email: string; status: string; checkedInAt: string | null };

const LOOK: Record<Result["result"], { tone: string; title: string; Icon: typeof CheckCircle2 }> = {
  checked_in: { tone: "bg-green-600", title: "Checked in", Icon: CheckCircle2 },
  already: { tone: "bg-orange-500", title: "Already checked in", Icon: AlertTriangle },
  waitlisted: { tone: "bg-red-600", title: "On the waiting list: not confirmed", Icon: XCircle },
  cancelled: { tone: "bg-red-600", title: "Registration cancelled", Icon: XCircle },
  wrong_event: { tone: "bg-red-600", title: "Ticket for a different event", Icon: XCircle },
  invalid: { tone: "bg-red-600", title: "Not a valid ticket", Icon: XCircle },
};

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const { call, can } = useAuth();
  const allowed = can("events.manage") || can("events.checkin");
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [counts, setCounts] = useState({ checkedIn: 0, confirmed: 0 });
  const [last, setLast] = useState<Result | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await call<{ event: AdminEvent; registrations: Person[] }>(`/admin/events/${id}/registrations`);
      setEvent(d.event);
      setPeople(d.registrations);
      setCounts({ checkedIn: d.event.checkedIn, confirmed: d.event.confirmed });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, id]);
  useEffect(() => {
    if (allowed) void load();
  }, [load, allowed]);

  const show = (r: Result) => {
    setLast(r);
    setCounts({ checkedIn: r.checkedIn, confirmed: r.confirmed });
    if (r.result === "checked_in" && r.registration) {
      setPeople((ps) => ps.map((p) => (p.id === r.registration!.id ? { ...p, checkedInAt: r.registration!.checkedInAt } : p)));
    }
    if (clearTimer.current) clearTimeout(clearTimer.current);
    // Ready for the next person after a moment.
    clearTimer.current = setTimeout(() => setLast(null), r.result === "checked_in" ? 2500 : 6000);
  };

  const run = async (fn: () => Promise<Result>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      show(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onScan = (text: string) =>
    run(() => call<Result>(`/admin/events/${id}/checkin`, { method: "POST", body: JSON.stringify({ code: text }) }));

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(n)).slice(0, 8);
  }, [q, people]);

  if (!allowed) return <Empty text="You don't have permission to check people in." />;
  if (!event) return error ? <Empty text={`This event couldn't be loaded: ${error}`} /> : null;

  const look = last ? LOOK[last.result] : null;
  return (
    <div className="max-w-xl mx-auto">
      <Link
        href={`/dashboard/events/${id}`}
        className="mb-3 inline-flex items-center gap-2 text-slate-400 hover:text-blue-900 text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft size={14} /> Event
      </Link>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Check-in</p>
          <h2 className="text-2xl font-black text-blue-900 uppercase tracking-tight truncate">{event.title}</h2>
          <p className="text-xs text-slate-500">{formatCairo(event.startsAt)}</p>
        </div>
        <div className="text-right shrink-0" aria-live="polite">
          <p className="text-3xl font-black text-blue-900 tabular-nums">
            {counts.checkedIn}
            <span className="text-slate-400 text-xl"> / {counts.confirmed}</span>
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">checked in</p>
        </div>
      </div>

      <QrScanner onScan={onScan} paused={busy} />

      {look && last && (
        <div role="status" className={`${look.tone} text-white rounded-[2rem] p-6 mt-4 shadow-xl animate-in fade-in zoom-in-95 duration-200`}>
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
            <look.Icon size={22} /> {look.title}
          </p>
          {last.registration && <p className="text-3xl font-black mt-2 break-words">{last.registration.name}</p>}
          {last.result === "already" && last.registration?.checkedInAt && (
            <p className="text-sm font-bold mt-1">at {formatCairo(last.registration.checkedInAt, "time")}</p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-red-600 font-bold text-sm">
          {error}
        </p>
      )}

      <div className="mt-6">
        <label htmlFor="checkin-search" className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Or search by name or email
        </label>
        <div className="relative mt-2">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="checkin-search"
            type="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type at least 2 letters"
            className={`${inputCls} pl-11`}
          />
        </div>
        <ul className="mt-3 space-y-2">
          {matches.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 bg-white rounded-2xl shadow px-4 py-3">
              <div className="min-w-0">
                <p className="font-black text-blue-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-500 truncate">
                  {p.email} ·{" "}
                  {p.checkedInAt ? "checked in" : p.status === "confirmed" ? "confirmed" : p.status === "waitlisted" ? "waiting list" : "cancelled"}
                </p>
              </div>
              <button
                disabled={busy || p.status !== "confirmed" || !!p.checkedInAt}
                onClick={() => run(() => call<Result>(`/admin/registrations/${p.id}/checkin`, { method: "POST" }))}
                className="shrink-0 px-4 py-3 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-widest disabled:bg-slate-200 disabled:text-slate-400"
              >
                Check in
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
