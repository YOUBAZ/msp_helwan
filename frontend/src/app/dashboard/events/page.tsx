"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Plus, ScanLine, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  inputCls,
  Modal,
  PageTitle,
} from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { formatCairo, fromCairoInput } from "@/lib/events";
import type { AdminEvent, EventLists, PublicEvent } from "@/lib/types";

type Tab = "upcoming" | "past" | "drafts";

const linkBtn =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest";

export default function EventsAdminPage() {
  const { call, can } = useAuth();
  const manage = can("events.manage");
  const checkin = can("events.checkin");
  const [events, setEvents] = useState<(AdminEvent | PublicEvent)[] | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      if (manage) setEvents(await call<AdminEvent[]>("/admin/events"));
      else {
        // Check-in volunteers: the public list of current and upcoming events.
        const l = await call<EventLists>("/events");
        setEvents([...l.live, ...l.upcoming]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, manage]);

  useEffect(() => {
    if (manage || checkin) void load();
  }, [load, manage, checkin]);

  if (!manage && !checkin) {
    return <Empty text="You don't have permission to manage events." />;
  }

  const isDraft = (e: AdminEvent | PublicEvent) => "published" in e && !e.published;
  const shown = (events ?? []).filter((e) =>
    !manage
      ? true
      : tab === "drafts"
        ? isDraft(e)
        : !isDraft(e) && (tab === "past" ? e.phase === "past" : e.phase !== "past"),
  );
  if (manage && tab === "past") shown.reverse();

  return (
    <>
      <PageTitle
        eyebrow="Events page"
        title="Events"
        action={
          manage && (
            <Button variant="accent" onClick={() => setCreating(true)}>
              <Plus size={16} /> New event
            </Button>
          )
        }
      />
      {manage && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(["upcoming", "past", "drafts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                tab === t ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20" : "bg-white text-slate-600 hover:text-orange-600"
              }`}
            >
              {t === "upcoming" ? "Upcoming & live" : t}
            </button>
          ))}
        </div>
      )}
      <div className="mb-4">
        <ErrorText error={error} />
      </div>

      {!events ? null : shown.length === 0 ? (
        <Empty text={manage ? "No events here." : "No current or upcoming events."} />
      ) : (
        <div className="space-y-3">
          {shown.map((e) => (
            <Card key={e.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-black text-blue-900">{e.title}</h3>
                  {isDraft(e) && <Badge tone="slate">Draft</Badge>}
                  {e.cancelled && <Badge tone="red">Cancelled</Badge>}
                  {e.phase === "live" && <Badge tone="green">Happening now</Badge>}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatCairo(e.startsAt)} · {e.venue}
                </p>
                <p className="text-xs font-bold text-slate-600 mt-2 flex items-center gap-1.5">
                  <Users size={14} className="text-orange-600" />
                  {e.confirmed}
                  {e.capacity !== null && ` / ${e.capacity}`} confirmed
                  {e.waitlisted > 0 && ` · ${e.waitlisted} waiting`}
                  {"checkedIn" in e && e.checkedIn > 0 && ` · ${e.checkedIn} checked in`}
                  {e.phase === "past" && e.attendance !== null && ` · ${e.attendance} attended`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {(e.phase !== "past" || manage) && !isDraft(e) && (
                  <Link href={`/dashboard/events/${e.id}/checkin`} className={`${linkBtn} bg-orange-600 text-white hover:bg-blue-900`}>
                    <ScanLine size={14} /> Check-in
                  </Link>
                )}
                <Link href={`/dashboard/events/${e.id}`} className={`${linkBtn} bg-blue-900 text-white hover:bg-orange-600`}>
                  {manage ? "Open" : "Registrations"}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && <NewEventDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function NewEventDialog({ onClose }: { onClose: () => void }) {
  const { call } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", category: "", startsAt: "" });
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call<string[]>("/admin/events/categories").then(setCategories, () => undefined);
  }, [call]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const ev = await call<AdminEvent>("/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          startsAt: fromCairoInput(form.startsAt),
        }),
      });
      router.push(`/dashboard/events/${ev.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New event" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Event title" id="n-title">
          <input
            id="n-title"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Azure Fundamentals Workshop"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Category" id="n-category">
            <input
              id="n-category"
              required
              minLength={2}
              maxLength={40}
              list="n-categories"
              placeholder="Workshop, Hackathon, Session…"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputCls}
            />
            <datalist id="n-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Starts (Cairo time)" id="n-start">
            <input
              id="n-start"
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          New events start as drafts: add the details, then publish when ready.
        </p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Creating…" : "Create event"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
