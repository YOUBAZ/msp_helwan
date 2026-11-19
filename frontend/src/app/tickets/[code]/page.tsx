"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Calendar, CheckCircle2, Clock, MapPin, Ticket as TicketIcon, XCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCairo } from "@/lib/events";
import type { Ticket } from "@/lib/types";

export default function TicketPage() {
  const { code } = useParams<{ code: string }>();
  const [t, setT] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setT(await api<Ticket>(`/tickets/${encodeURIComponent(code)}`, { cache: "no-store" }));
    } catch (e) {
      setNotFound(e instanceof ApiError && e.status === 404);
      setError((e as Error).message);
    }
  }, [code]);
  useEffect(() => {
    void load();
  }, [load]);

  async function cancel() {
    if (!confirm("Cancel your registration? Your seat will go to the next person on the waiting list.")) return;
    setBusy(true);
    try {
      await api(`/tickets/${encodeURIComponent(code)}/cancel`, { method: "POST" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!t) {
    return (
      <section className="py-24 min-h-[70vh] flex items-center justify-center px-6">
        {error ? (
          <div className="text-center space-y-4">
            <p className="text-slate-600 font-bold">
              {notFound ? <>This ticket couldn&apos;t be found. Check the link in your email.</> : error}
            </p>
            {!notFound && (
              <button onClick={() => void load()} className="block mx-auto text-orange-600 font-black text-xs uppercase tracking-widest">
                Try again
              </button>
            )}
            <Link href="/events" className="text-blue-900 font-black text-xs uppercase tracking-widest">
              See all events
            </Link>
          </div>
        ) : (
          <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading your ticket…</p>
        )}
      </section>
    );
  }

  const e = t.event;
  const canCancel = t.status !== "cancelled" && e.phase === "upcoming" && !e.cancelled;
  const state =
    e.cancelled
      ? { label: "Event cancelled", tone: "bg-red-100 text-red-700", Icon: XCircle }
      : t.status === "confirmed"
        ? t.checkedInAt
          ? { label: "Checked in", tone: "bg-green-100 text-green-700", Icon: CheckCircle2 }
          : { label: "Confirmed", tone: "bg-green-100 text-green-700", Icon: CheckCircle2 }
        : t.status === "waitlisted"
          ? { label: `Waiting list · number ${t.position}`, tone: "bg-orange-100 text-orange-700", Icon: Clock }
          : { label: "Cancelled", tone: "bg-slate-100 text-slate-600", Icon: XCircle };

  return (
    <section className="py-12 md:py-20 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-lg">
        <Link
          href={`/events/${e.id}`}
          className="mb-6 inline-flex items-center gap-2 text-slate-400 hover:text-blue-900 text-xs font-black uppercase tracking-widest"
        >
          <ArrowLeft size={14} /> Event page
        </Link>
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="bg-blue-900 text-white p-6 md:p-8">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              <TicketIcon size={14} /> Your ticket
            </p>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight mt-2">{e.title}</h1>
            <p className="mt-1 text-blue-100 font-bold">{t.name}</p>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${state.tone}`}>
              <state.Icon size={16} /> {state.label}
            </span>
            {t.qr && !e.cancelled && (
              <div className="flex flex-col items-center gap-3">
                <img src={t.qr} alt="Ticket QR code" className="w-64 h-64 rounded-2xl border border-slate-100" />
                <p className="text-xs text-slate-500 text-center">Show this code at the door.</p>
              </div>
            )}
            {t.status === "waitlisted" && !e.cancelled && (
              <p className="text-sm text-slate-600">
                The event is full. If a seat opens up, it&apos;s yours automatically and we&apos;ll email your ticket.
              </p>
            )}
            <ul className="space-y-2 text-slate-700 font-bold text-sm">
              <li className="flex items-center gap-3">
                <Calendar size={16} className="text-orange-600" /> {formatCairo(e.startsAt)}
              </li>
              <li className="flex items-center gap-3">
                <MapPin size={16} className="text-orange-600" /> {e.venue}
              </li>
            </ul>
            {error && <p role="alert" className="text-red-600 text-sm font-bold">{error}</p>}
            {canCancel && (
              <button
                onClick={() => void cancel()}
                disabled={busy}
                className="w-full py-3 rounded-2xl border border-red-200 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-60"
              >
                {busy ? "Cancelling…" : "Cancel my registration"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
