"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CircleCheck, CopyPlus, Pencil, Plus, Trash2 } from "lucide-react";
import CommitteeDialog from "@/components/dashboard/CommitteeDialog";
import { Badge, Button, Card, Empty, ErrorText, inputCls, labelCls, Modal, PageTitle } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { committeeIcon, TRACK_LABEL } from "@/lib/committees";
import type { Committee, CommitteeTrack } from "@/lib/types";

type Season = { id: string; number: number; name: string; status: "draft" | "current" | "archived" };
type SeasonData = {
  season: Season;
  committees: Committee[];
  previous: Season | null;
  previousCommittees: Committee[];
};

const STATUS: Record<Season["status"], { tone: "slate" | "green" | "orange"; label: string }> = {
  draft: { tone: "slate", label: "Draft" },
  current: { tone: "green", label: "Current" },
  archived: { tone: "orange", label: "Archived" },
};

/** Default: the current season, else the newest draft, else the newest. */
const pickDefault = (list: Season[]) =>
  list.find((s) => s.status === "current") ?? list.find((s) => s.status === "draft") ?? list[0];

export default function CommitteesAdminPage() {
  const { call, can } = useAuth();
  const allowed = can("committees.manage");
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [seasonId, setSeasonId] = useState("");
  const [data, setData] = useState<SeasonData | null>(null);
  const [dialog, setDialog] = useState<{ kind: "edit"; committee?: Committee } | { kind: "copy" } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    call<Season[]>("/admin/committees/seasons").then(
      (list) => {
        setSeasons(list);
        setSeasonId((id) => id || pickDefault(list)?.id || "");
      },
      (e: Error) => setError(e.message),
    );
  }, [call, allowed]);

  const load = useCallback(async () => {
    if (!seasonId) return;
    try {
      setData(await call<SeasonData>(`/admin/seasons/${seasonId}/committees`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, seasonId]);
  useEffect(() => {
    void load();
  }, [load]);

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

  if (!allowed) return <Empty text="You don't have permission to manage committees." />;
  if (!seasons) return error ? <Empty text={error} /> : null;
  if (seasons.length === 0) {
    return (
      <>
        <PageTitle eyebrow="Committees page" title="Committees" />
        <Card className="p-8 text-sm text-slate-600 space-y-3">
          <p>There are no seasons yet. Committees belong to a season.</p>
          {can("seasons.manage") ? (
            <Link href="/dashboard/hierarchy" className="font-black text-blue-900 underline">
              Create a season in Team Hierarchy
            </Link>
          ) : (
            <p>Ask the President to create the season in Team Hierarchy.</p>
          )}
        </Card>
      </>
    );
  }

  const season = data?.season;
  const readOnly = season?.status === "archived";
  const tracks: CommitteeTrack[] = ["technical", "non_technical"];

  return (
    <>
      <PageTitle
        eyebrow="Committees page"
        title="Committees"
        action={
          season &&
          !readOnly && (
            <div className="flex flex-wrap gap-2">
              {data.previous && data.previousCommittees.length > 0 && (
                <Button variant="ghost" onClick={() => setDialog({ kind: "copy" })}>
                  <CopyPlus size={16} /> Copy from {data.previous.name}
                </Button>
              )}
              <Button variant="accent" onClick={() => setDialog({ kind: "edit" })}>
                <Plus size={16} /> Add committee
              </Button>
            </div>
          )
        }
      />

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <label className="space-y-1.5">
          <span className={labelCls}>Season</span>
          <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} className={`${inputCls} min-w-56`}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({STATUS[s.status].label.toLowerCase()})
              </option>
            ))}
          </select>
        </label>
        {season && <Badge tone={STATUS[season.status].tone}>{STATUS[season.status].label}</Badge>}
        {season?.status === "draft" && (
          <span className="text-xs text-slate-500 pb-3">Drafts aren&apos;t public until the season is published.</span>
        )}
      </div>
      {readOnly && (
        <p className="mb-6 p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-800 text-sm font-bold">
          {season.name} is archived, so its committees can&apos;t be changed. Copy the ones that continue into the new
          season instead.
        </p>
      )}
      <div className="mb-4">
        <ErrorText error={error} />
      </div>

      {data && data.committees.length === 0 && (
        <Empty text={readOnly ? "This season had no committees." : "No committees yet. Add one or copy from last season."} />
      )}
      {data &&
        tracks.map((t) => {
          const list = data.committees.filter((c) => c.track === t);
          if (list.length === 0) return null;
          return (
            <div key={t} className="mb-10">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-3">{TRACK_LABEL[t]}</h3>
              <div className="space-y-3">
                {list.map((c, i) => {
                  const Icon = committeeIcon(c.icon);
                  return (
                    <Card key={c.id} className="p-5 flex flex-col md:flex-row md:items-start gap-4">
                      <div className="p-3 rounded-2xl bg-blue-900 text-white self-start">
                        <Icon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-blue-900">{c.name}</h4>
                        {c.description && <p className="text-sm text-slate-600 mt-1">{c.description}</p>}
                        {c.tasks.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {c.tasks.map((task) => (
                              <li key={task} className="flex items-center gap-1.5 text-xs text-slate-500">
                                <CircleCheck size={12} className="text-orange-600" /> {task}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex gap-1 shrink-0">
                          <IconBtn
                            label="Move up"
                            disabled={busy || i === 0}
                            onClick={() =>
                              void act(() =>
                                call(`/admin/committees/${c.id}/move`, { method: "POST", body: JSON.stringify({ direction: "up" }) }),
                              )
                            }
                          >
                            <ArrowUp size={16} />
                          </IconBtn>
                          <IconBtn
                            label="Move down"
                            disabled={busy || i === list.length - 1}
                            onClick={() =>
                              void act(() =>
                                call(`/admin/committees/${c.id}/move`, { method: "POST", body: JSON.stringify({ direction: "down" }) }),
                              )
                            }
                          >
                            <ArrowDown size={16} />
                          </IconBtn>
                          <IconBtn label="Edit" onClick={() => setDialog({ kind: "edit", committee: c })}>
                            <Pencil size={16} />
                          </IconBtn>
                          <IconBtn
                            label="Delete"
                            danger
                            disabled={busy}
                            onClick={() =>
                              confirm(`Delete "${c.name}" from ${season?.name}?`) &&
                              void act(() => call(`/admin/committees/${c.id}`, { method: "DELETE" }))
                            }
                          >
                            <Trash2 size={16} />
                          </IconBtn>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

      {dialog?.kind === "edit" && season && (
        <CommitteeDialog
          seasonId={season.id}
          seasonName={season.name}
          committee={dialog.committee}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void load();
          }}
        />
      )}
      {dialog?.kind === "copy" && data?.previous && season && (
        <CopyDialog
          target={season}
          from={data.previous}
          committees={data.previousCommittees}
          existing={data.committees.map((c) => c.name.toLowerCase())}
          onClose={() => setDialog(null)}
          onCopied={() => void load()}
        />
      )}
    </>
  );
}

function CopyDialog({
  target,
  from,
  committees,
  existing,
  onClose,
  onCopied,
}: {
  target: Season;
  from: Season;
  committees: Committee[];
  existing: string[];
  onClose: () => void;
  onCopied: () => void;
}) {
  const { call } = useAuth();
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(committees.map((c) => [c.id, c.name])),
  );
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

  async function copy(c: Committee) {
    setBusy(c.id);
    setErrors((e) => ({ ...e, [c.id]: "" }));
    try {
      await call(`/admin/seasons/${target.id}/committees/copy`, {
        method: "POST",
        body: JSON.stringify({ committeeId: c.id, name: names[c.id]?.trim() || c.name }),
      });
      setCopied((s) => ({ ...s, [c.id]: true }));
      onCopied();
    } catch (err) {
      setErrors((e) => ({ ...e, [c.id]: (err as Error).message }));
    } finally {
      setBusy("");
    }
  }

  return (
    <Modal title={`Copy from ${from.name}`} onClose={onClose}>
      <p className="text-sm text-slate-600 mb-5">
        Pick the committees that continue into {target.name}. You can rename each one before copying; its icon,
        description and tasks come along and can be edited after.
      </p>
      <ul className="space-y-3">
        {committees.map((c) => {
          const Icon = committeeIcon(c.icon);
          const taken = existing.includes((names[c.id] ?? c.name).trim().toLowerCase());
          return (
            <li key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-2xl border border-slate-100">
              <Icon size={20} className="text-blue-900 shrink-0 hidden sm:block" />
              <input
                aria-label={`New name for ${c.name}`}
                maxLength={80}
                value={names[c.id] ?? ""}
                onChange={(e) => setNames((n) => ({ ...n, [c.id]: e.target.value }))}
                className={`${inputCls} py-2.5`}
              />
              <Button
                type="button"
                variant={copied[c.id] ? "ghost" : "accent"}
                disabled={busy === c.id || copied[c.id] || taken}
                title={taken ? `${target.name} already has a committee with this name` : undefined}
                onClick={() => void copy(c)}
              >
                {copied[c.id] ? "Copied" : taken ? "Already there" : "Copy"}
              </Button>
              {errors[c.id] && <p className="text-xs font-bold text-red-600 sm:basis-full">{errors[c.id]}</p>}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end mt-6">
        <Button type="button" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}

function IconBtn({
  label,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`p-2.5 rounded-xl text-slate-500 disabled:opacity-30 ${
        danger ? "hover:text-red-600 hover:bg-red-50" : "hover:text-blue-900 hover:bg-slate-100"
      }`}
    />
  );
}
