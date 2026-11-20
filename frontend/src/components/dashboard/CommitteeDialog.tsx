"use client";

import { FormEvent, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, ErrorText, Field, inputCls, labelCls, Modal } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { COMMITTEE_ICONS, TRACK_LABEL } from "@/lib/committees";
import type { Committee, CommitteeTrack } from "@/lib/types";

const MAX_TASKS = 12;

/** Add or edit a committee. */
export default function CommitteeDialog({
  seasonId,
  seasonName,
  committee,
  onClose,
  onSaved,
}: {
  seasonId: string;
  seasonName: string;
  /** Present when editing. */
  committee?: Committee;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { call } = useAuth();
  const [form, setForm] = useState({
    name: committee?.name ?? "",
    track: committee?.track ?? ("technical" as CommitteeTrack),
    icon: committee?.icon ?? "users",
    description: committee?.description ?? "",
    tasks: committee?.tasks.length ? committee.tasks : [""],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setTask = (i: number, v: string) => setForm((f) => ({ ...f, tasks: f.tasks.map((t, j) => (j === i ? v : t)) }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = JSON.stringify({ ...form, tasks: form.tasks.map((t) => t.trim()).filter(Boolean) });
    try {
      if (committee) await call(`/admin/committees/${committee.id}`, { method: "PATCH", body });
      else await call(`/admin/seasons/${seasonId}/committees`, { method: "POST", body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={committee ? `Edit ${committee.name}` : `New committee · ${seasonName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Committee name" id="c-name">
          <input
            id="c-name"
            required
            minLength={2}
            maxLength={80}
            placeholder="e.g. AI & Data Science"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Field>

        <fieldset className="space-y-2">
          <legend className={labelCls}>Type</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TRACK_LABEL) as CommitteeTrack[]).map((t) => (
              <label
                key={t}
                className={`px-4 py-2.5 rounded-xl border text-sm font-bold cursor-pointer ${
                  form.track === t ? "border-blue-900 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="c-track"
                  className="sr-only"
                  checked={form.track === t}
                  onChange={() => setForm({ ...form, track: t })}
                />
                {TRACK_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={labelCls}>Icon</legend>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
            {Object.entries(COMMITTEE_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                aria-label={key}
                aria-pressed={form.icon === key}
                title={key}
                onClick={() => setForm({ ...form, icon: key })}
                className={`aspect-square flex items-center justify-center rounded-xl border transition-colors ${
                  form.icon === key
                    ? "bg-orange-600 border-orange-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
              >
                <Icon size={20} />
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Description" id="c-desc">
          <textarea
            id="c-desc"
            rows={3}
            maxLength={300}
            placeholder="One or two sentences about what the committee does"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
          />
        </Field>

        <div className="space-y-2">
          <p className={labelCls}>What members learn or do (up to {MAX_TASKS})</p>
          {form.tasks.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                aria-label={`Task ${i + 1}`}
                maxLength={80}
                value={t}
                onChange={(e) => setTask(i, e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                aria-label={`Remove task ${i + 1}`}
                onClick={() => setForm((f) => ({ ...f, tasks: f.tasks.filter((_, j) => j !== i) }))}
                className="p-3 rounded-xl text-slate-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={form.tasks.length >= MAX_TASKS}
            onClick={() => setForm((f) => ({ ...f, tasks: [...f.tasks, ""] }))}
          >
            <Plus size={14} /> Add task
          </Button>
        </div>

        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Saving…" : committee ? "Save changes" : "Add committee"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
