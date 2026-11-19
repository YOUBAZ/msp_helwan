"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { registrationLabel, seatsLeft } from "@/lib/events";
import type { Answers, PublicEvent } from "@/lib/types";
import FormFields from "./FormFields";

const inputCls =
  "w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-900 outline-none";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500";

/** Drop blank answers (the server treats them as unanswered anyway). */
function cleanAnswers(a: Answers): Answers {
  const out: Answers = {};
  for (const [k, v] of Object.entries(a)) {
    if (Array.isArray(v) ? v.length > 0 : v.trim() !== "") out[k] = v;
  }
  return out;
}

/** Live registration state (never cached) and the sign-up form. */
export default function RegistrationBox({ initial }: { initial: PublicEvent }) {
  const router = useRouter();
  const [event, setEvent] = useState(initial);
  const [form, setForm] = useState({ name: "", email: "", website: "" });
  const [answers, setAnswers] = useState<Answers>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      setEvent(await api<PublicEvent>(`/events/${initial.id}`, { cache: "no-store" }));
    } catch {}
  }, [initial.id]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await api<{ ticketCode: string }>(`/events/${event.id}/register`, {
        method: "POST",
        body: JSON.stringify({ ...form, answers: cleanAnswers(answers) }),
      });
      router.push(`/tickets/${r.ticketCode}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (/already registered/i.test(msg)) setNotice(msg);
      else setError(msg);
      setBusy(false);
      void refresh();
    }
  }

  const left = seatsLeft(event);
  if (event.registration === "closed") {
    return (
      <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
        <p className="font-black text-slate-700 uppercase tracking-widest text-xs">{registrationLabel(event)}</p>
        {event.phase === "upcoming" && !event.cancelled && (
          <p className="text-sm text-slate-500 mt-2">Registration for this event is closed.</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-6 md:p-8 rounded-[2rem] bg-slate-50 border border-slate-100 space-y-4">
      <div>
        <h3 className="text-xl font-black text-blue-900 uppercase">
          {event.registration === "waitlist" ? "Join the waiting list" : "Register"}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {event.registration === "waitlist"
            ? "The event is full. Join the waiting list: if a seat opens up, it's yours automatically and we'll email your ticket."
            : left !== null
              ? `${left} seat${left === 1 ? "" : "s"} left. No account needed.`
              : "No account needed. You'll get your ticket by email."}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="space-y-1.5 sm:col-span-2">
          <span className={labelCls}>
            Full name<span className="text-orange-600"> *</span>
          </span>
          <input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={set("name")} className={inputCls} />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className={labelCls}>
            Email<span className="text-orange-600"> *</span>
          </span>
          <input required type="email" autoComplete="email" value={form.email} onChange={set("email")} className={inputCls} />
        </label>
        <FormFields form={event.form} answers={answers} onChange={setAnswers} idPrefix="reg" />
      </div>
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>
      {error && <p role="alert" className="text-red-600 text-sm font-bold">{error}</p>}
      {notice && <p role="status" className="text-blue-900 text-sm font-bold">{notice}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-blue-900 transition-all shadow-lg disabled:opacity-60"
      >
        {busy ? "Registering…" : event.registration === "waitlist" ? "Join waiting list" : "Get my ticket"}
      </button>
    </form>
  );
}
