"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Camera,
  Copy,
  Download,
  Eye,
  EyeOff,
  ScanLine,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  inputCls,
  labelCls,
  PageTitle,
} from "@/components/dashboard/ui";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { coverSrc, formatCairo, fromCairoInput, toCairoInput } from "@/lib/events";
import { photoVersions } from "@/lib/image";
import FormBuilder from "@/components/dashboard/FormBuilder";
import type { AdminEvent, Answers, MediaAlbum, Question } from "@/lib/types";

type Reg = {
  id: string;
  name: string;
  email: string;
  /** Only for people who can manage events. */
  answers?: Answers;
  status: "confirmed" | "waitlisted" | "cancelled";
  position: number | null;
  /** Only for people who can manage events (a ticket link can cancel). */
  ticketUrl?: string;
  createdAt: string;
  checkedInAt: string | null;
};

export default function EventEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const manage = can("events.manage");
  const [tab, setTab] = useState<"details" | "form" | "registrations">(manage ? "details" : "registrations");
  if (!manage && !can("events.checkin")) return <Empty text="You don't have permission to see this event." />;
  return (
    <>
      <Link
        href="/dashboard/events"
        className="mb-4 inline-flex items-center gap-2 text-slate-400 hover:text-blue-900 text-xs font-black uppercase tracking-widest"
      >
        <ArrowLeft size={14} /> All events
      </Link>
      {manage && (
        <div className="flex flex-wrap gap-2 mb-6">
          {(["details", "form", "registrations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                tab === t ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20" : "bg-white text-slate-600 hover:text-orange-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      {tab === "details" && manage ? <Details id={id} /> : tab === "form" && manage ? <FormTab id={id} /> : <Registrations id={id} />}
    </>
  );
}

// ---------------------------------------------------------------- Details

function Details({ id }: { id: string }) {
  const { call, can } = useAuth();
  const router = useRouter();
  const [ev, setEv] = useState<AdminEvent | null>(null);
  const [albums, setAlbums] = useState<MediaAlbum[]>([]);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState(false);

  const fill = (e: AdminEvent) => {
    setEv(e);
    setForm({
      title: e.title,
      category: e.category,
      description: e.description,
      venue: e.venue,
      startsAt: toCairoInput(e.startsAt),
      endsAt: toCairoInput(e.endsAt),
      capacity: e.capacity?.toString() ?? "",
      registrationOpen: e.registrationOpen,
      registrationDeadline: toCairoInput(e.registrationDeadline),
      partners: e.partners.join(", "),
      highlight: e.highlight ?? "",
      manualAttendance: e.manualAttendance?.toString() ?? "",
      mediaAlbumId: e.mediaAlbumId ?? "",
    });
  };

  const load = useCallback(async () => {
    try {
      fill(await call<AdminEvent>(`/admin/events/${id}`));
    } catch (e) {
      setMsg({ ok: "", err: (e as Error).message });
    }
  }, [call, id]);

  useEffect(() => {
    void load();
    if (can("media.manage")) call<MediaAlbum[]>("/admin/media/albums").then(setAlbums, () => undefined);
  }, [load, call, can]);

  if (!ev) return msg.err ? <Empty text={`This event couldn't be loaded: ${msg.err}`} /> : null;

  const registered = ev.confirmed + ev.waitlisted;
  const str = (k: string) => (form[k] as string) ?? "";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg({ ok: "", err: "" });
    try {
      await fn();
      await load();
      setMsg({ ok, err: "" });
    } catch (e) {
      setMsg({ ok: "", err: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const startsAt = fromCairoInput(str("startsAt"));
    const endsAt = fromCairoInput(str("endsAt"));
    const changedWhenWhere =
      startsAt !== new Date(ev!.startsAt).toISOString() ||
      endsAt !== (ev!.endsAt ? new Date(ev!.endsAt).toISOString() : null) ||
      str("venue") !== ev!.venue;
    const notifyChanges =
      changedWhenWhere && registered > 0
        ? confirm(`Tell the ${registered} registered people about the new date, time or venue? (Cancel = save without emailing.)`)
        : false;
    await act(
      () =>
        call(`/admin/events/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: str("title"),
            category: str("category"),
            description: str("description"),
            venue: str("venue"),
            startsAt,
            endsAt,
            capacity: str("capacity") ? Number(str("capacity")) : null,
            registrationOpen: !!form.registrationOpen,
            registrationDeadline: fromCairoInput(str("registrationDeadline")),
            partners: str("partners").split(",").map((p) => p.trim()).filter(Boolean),
            highlight: str("highlight") || null,
            manualAttendance: str("manualAttendance") ? Number(str("manualAttendance")) : null,
            ...(can("media.manage") ? { mediaAlbumId: str("mediaAlbumId") || null } : {}),
            notifyChanges,
          }),
        }),
      "Saved.",
    );
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    await act(async () => {
      const { full } = await photoVersions(file);
      const body = new FormData();
      body.append("file", full, "cover.jpg");
      await call(`/admin/events/${id}/cover`, { method: "POST", body });
    }, "Cover updated.");
  }

  const cover = coverSrc(ev);
  return (
    <>
      <PageTitle
        eyebrow={ev.category}
        title={ev.title}
        action={
          <div className="flex flex-wrap gap-2">
            {ev.published && (
              <Link
                href={`/events/${ev.id}`}
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-white text-blue-900 border border-slate-200 hover:text-orange-600"
              >
                <Eye size={14} /> View page
              </Link>
            )}
            {!ev.cancelled && (
              <Button
                variant={ev.published ? "ghost" : "accent"}
                disabled={busy}
                onClick={() =>
                  void act(
                    () => call(`/admin/events/${id}`, { method: "PATCH", body: JSON.stringify({ published: !ev.published }) }),
                    ev.published ? "Unpublished." : "Published: it's on the Events page.",
                  )
                }
              >
                {ev.published ? <EyeOff size={14} /> : <Eye size={14} />} {ev.published ? "Unpublish" : "Publish"}
              </Button>
            )}
            {ev.published && !ev.cancelled && ev.phase !== "past" && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  confirm(
                    `Cancel "${ev.title}"? ${registered} registered people will be emailed, and the event will show as cancelled.`,
                  ) && void act(() => call(`/admin/events/${id}/cancel`, { method: "POST" }), "Event cancelled.")
                }
              >
                <Ban size={14} /> Cancel event
              </Button>
            )}
            {registered === 0 && ev.confirmed + ev.waitlisted === 0 && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Delete "${ev.title}"? This can't be undone.`)) return;
                  try {
                    await call(`/admin/events/${id}`, { method: "DELETE" });
                    router.push("/dashboard/events");
                  } catch (e) {
                    setMsg({ ok: "", err: (e as Error).message });
                  }
                }}
              >
                <Trash2 size={14} /> Delete
              </Button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-2 mb-6 -mt-4">
        <Badge tone={ev.published ? "green" : "slate"}>{ev.published ? "Published" : "Draft (hidden)"}</Badge>
        {ev.cancelled && <Badge tone="red">Cancelled</Badge>}
        <span className="text-xs font-bold text-slate-500">
          {ev.confirmed}
          {ev.capacity !== null && ` / ${ev.capacity}`} confirmed · {ev.waitlisted} waiting · {ev.checkedIn} checked in
        </span>
      </div>
      <div className="mb-4">
        <ErrorText error={msg.err} />
        {msg.ok && <p className="text-green-600 text-sm font-bold">{msg.ok}</p>}
      </div>

      <div className="grid xl:grid-cols-[1fr_340px] gap-6 items-start">
        <Card className="p-6 md:p-8">
          <form onSubmit={save} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title" id="e-title">
                <input id="e-title" required minLength={2} maxLength={120} value={str("title")} onChange={set("title")} className={inputCls} />
              </Field>
              <Field label="Category" id="e-category">
                <input id="e-category" required minLength={2} maxLength={40} value={str("category")} onChange={set("category")} className={inputCls} />
              </Field>
              <Field label="Starts (Cairo time)" id="e-start">
                <input id="e-start" type="datetime-local" required value={str("startsAt")} onChange={set("startsAt")} className={inputCls} />
              </Field>
              <Field label="Ends (optional)" id="e-end">
                <input id="e-end" type="datetime-local" value={str("endsAt")} onChange={set("endsAt")} className={inputCls} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Venue" id="e-venue">
                  <input id="e-venue" required minLength={2} maxLength={200} value={str("venue")} onChange={set("venue")} className={inputCls} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Description" id="e-desc">
                  <textarea id="e-desc" rows={6} maxLength={5000} value={str("description")} onChange={set("description")} className={inputCls} />
                </Field>
              </div>
              <Field label="Partners (comma-separated)" id="e-partners">
                <input id="e-partners" placeholder="e.g. Microsoft, Dotpy" value={str("partners")} onChange={set("partners")} className={inputCls} />
              </Field>
              <Field label="Highlight (optional)" id="e-highlight">
                <input id="e-highlight" maxLength={80} placeholder="e.g. Industry Certification" value={str("highlight")} onChange={set("highlight")} className={inputCls} />
              </Field>
            </div>

            <h3 className="text-xs font-black uppercase tracking-widest text-blue-900 pt-2">Registration</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 md:col-span-2 cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-blue-900" checked={!!form.registrationOpen} onChange={set("registrationOpen")} />
                <span className="font-bold text-slate-800 text-sm">Registration open</span>
              </label>
              <Field label="Capacity (empty = unlimited)" id="e-capacity">
                <input id="e-capacity" type="number" min={1} value={str("capacity")} onChange={set("capacity")} className={inputCls} />
              </Field>
              <Field label="Registration deadline (optional)" id="e-deadline">
                <input id="e-deadline" type="datetime-local" value={str("registrationDeadline")} onChange={set("registrationDeadline")} className={inputCls} />
              </Field>
            </div>

            <h3 className="text-xs font-black uppercase tracking-widest text-blue-900 pt-2">After the event</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Attendance (only if check-in wasn't used)" id="e-att">
                <input id="e-att" type="number" min={0} value={str("manualAttendance")} onChange={set("manualAttendance")} className={inputCls} />
              </Field>
              {can("media.manage") ? (
                <Field label="Photos (Media album)" id="e-album">
                  <select id="e-album" value={str("mediaAlbumId")} onChange={set("mediaAlbumId")} className={inputCls}>
                    <option value="">No album</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-xs text-slate-400 self-end pb-3">
                  {ev.mediaAlbumId ? "Linked to a Media album." : "Linking a Media album needs the Media permission."}
                </p>
              )}
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 space-y-4">
          <p className={labelCls}>Cover photo</p>
          {cover ? (
            <img src={cover} alt="" className="w-full aspect-video object-cover rounded-2xl" />
          ) : (
            <div className="w-full aspect-video rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
              <Camera size={36} />
            </div>
          )}
          <input
            id="cover-file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void uploadCover(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <Button type="button" variant="accent" disabled={busy} onClick={() => document.getElementById("cover-file")?.click()}>
              <Camera size={14} /> {cover ? "Change" : "Upload"}
            </Button>
            {cover && (
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => void act(() => call(`/admin/events/${id}/cover`, { method: "DELETE" }), "Cover removed.")}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-400">Resized automatically. Counts toward the Media storage budget.</p>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Registrations

function Registrations({ id }: { id: string }) {
  const { call, can, token } = useAuth();
  const manage = can("events.manage");
  const [data, setData] = useState<{
    event: AdminEvent;
    form: Question[];
    removedQuestions: { id: string; title: string }[];
    registrations: Reg[];
  } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "confirmed" | "waitlisted" | "cancelled" | "in">("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await call(`/admin/events/${id}/registrations`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, id]);
  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.registrations ?? []).filter(
      (r) =>
        (filter === "all" ||
          (filter === "in" ? !!r.checkedInAt : r.status === filter)) &&
        (!needle || `${r.name} ${r.email} ${Object.values(r.answers ?? {}).flat().join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [data, q, filter]);

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  async function downloadCsv() {
    setError("");
    try {
      const res = await fetch(`${API_URL}/admin/events/${id}/registrations.csv`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("The spreadsheet couldn't be downloaded.");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "registrations.csv";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!data) return error ? <Empty text={`Registrations couldn't be loaded: ${error}`} /> : null;
  const ev = data.event;

  return (
    <>
      {!manage && <PageTitle eyebrow={ev.category} title={ev.title} />}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <p className="text-sm font-bold text-slate-600 flex-1">
          {formatCairo(ev.startsAt)} · {ev.confirmed}
          {ev.capacity !== null && ` / ${ev.capacity}`} confirmed · {ev.waitlisted} waiting · {ev.checkedIn} checked in
        </p>
        <div className="flex flex-wrap gap-2">
          {ev.published && !ev.cancelled && (
            <Link
              href={`/dashboard/events/${id}/checkin`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-orange-600 text-white hover:bg-blue-900"
            >
              <ScanLine size={14} /> Check-in
            </Link>
          )}
          {manage && (
            <Button variant="ghost" onClick={() => void downloadCsv()}>
              <Download size={14} /> Download CSV
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="search"
          aria-label="Search registrations"
          placeholder="Search name, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputCls} py-3 sm:max-w-xs`}
        />
        <select
          aria-label="Filter by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className={`${inputCls} py-3 sm:max-w-[200px]`}
        >
          <option value="all">Everyone</option>
          <option value="confirmed">Confirmed</option>
          <option value="in">Checked in</option>
          <option value="waitlisted">Waiting list</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div className="mb-4">
        <ErrorText error={error} />
      </div>
      {rows.length === 0 ? (
        <Empty text="Nobody here yet." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-4 md:p-5 flex flex-col md:flex-row md:flex-wrap md:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-blue-900">{r.name}</span>
                  {r.checkedInAt ? (
                    <Badge tone="green">Checked in {formatCairo(r.checkedInAt, "time")}</Badge>
                  ) : r.status === "confirmed" ? (
                    <Badge tone="blue">Confirmed</Badge>
                  ) : r.status === "waitlisted" ? (
                    <Badge tone="orange">Waiting #{r.position}</Badge>
                  ) : (
                    <Badge tone="slate">Cancelled</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 break-all">
                  {r.email}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {r.answers && (
                  <Button variant="ghost" aria-expanded={!!open[r.id]} onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                    {open[r.id] ? "Hide answers" : "Answers"}
                  </Button>
                )}
                {r.status === "confirmed" && !r.checkedInAt && (
                  <Button variant="ghost" disabled={busy} onClick={() => void act(() => call(`/admin/registrations/${r.id}/checkin`, { method: "POST" }))}>
                    <UserCheck size={14} /> Check in
                  </Button>
                )}
                {r.ticketUrl && (
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.ticketUrl!);
                        setCopied(r.id);
                        setTimeout(() => setCopied(""), 2000);
                      } catch {}
                    }}
                  >
                    <Copy size={14} /> {copied === r.id ? "Copied" : "Ticket link"}
                  </Button>
                )}
                {manage && r.status === "waitlisted" && (
                  <Button variant="ghost" disabled={busy} onClick={() => void act(() => call(`/admin/registrations/${r.id}/promote`, { method: "POST" }))}>
                    <UserPlus size={14} /> Move in
                  </Button>
                )}
                {manage && r.status !== "cancelled" && !r.checkedInAt && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      confirm(`Cancel ${r.name}'s registration? They'll be emailed, and the next person on the waiting list moves in.`) &&
                      void act(() => call(`/admin/registrations/${r.id}/cancel`, { method: "POST" }))
                    }
                  >
                    <UserX size={14} /> Cancel
                  </Button>
                )}
              </div>
              {open[r.id] && r.answers && data && (
                <AnswerList answers={r.answers} form={data.form} removed={data.removedQuestions} />
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Form

function FormTab({ id }: { id: string }) {
  const { call } = useAuth();
  const [ev, setEv] = useState<AdminEvent | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setEv(await call<AdminEvent>(`/admin/events/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!ev) return error ? <Empty text={`This event couldn't be loaded: ${error}`} /> : null;
  return <FormBuilder key={ev.id} event={ev} onSaved={() => void load()} />;
}

function AnswerList({
  answers,
  form,
  removed,
}: {
  answers: Answers;
  form: Question[];
  removed: { id: string; title: string }[];
}) {
  const rows = [
    ...form.map((q) => ({ id: q.id, title: q.title, link: q.type === "link" })),
    ...removed.map((q) => ({ id: q.id, title: `${q.title} (removed)`, link: false })),
  ].filter((q) => answers[q.id] !== undefined);
  if (rows.length === 0) return <p className="basis-full text-xs text-slate-500">No answers.</p>;
  return (
    <dl className="basis-full grid sm:grid-cols-[minmax(0,14rem)_1fr] gap-x-4 gap-y-2 pt-3 border-t border-slate-100 text-sm">
      {rows.map((q) => {
        const v = answers[q.id];
        const text = Array.isArray(v) ? v.join(", ") : v;
        return (
          <div key={q.id} className="contents">
            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500 sm:pt-0.5">{q.title}</dt>
            <dd className="text-slate-800 break-words">
              {q.link && /^https?:\/\//i.test(text) ? (
                <a href={text} target="_blank" rel="noopener noreferrer" className="text-blue-900 underline break-all">
                  {text}
                </a>
              ) : (
                text
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
