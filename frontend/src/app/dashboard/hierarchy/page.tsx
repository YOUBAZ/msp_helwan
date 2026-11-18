"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Lock,
  Pencil,
  Plus,
  Rocket,
  Trash2,
  X,
} from "lucide-react";
import Avatar from "@/components/dashboard/Avatar";
import PersonPicker, { type PickablePerson } from "@/components/dashboard/PersonPicker";
import { Linkedin } from "@/components/BrandIcons";
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
import { childrenByParent } from "@/lib/hierarchy";
import type { HierarchyPosition, HierarchyTree, Season } from "@/lib/types";

type Person = PickablePerson;

const statusTone = { draft: "slate", current: "green", archived: "blue" } as const;
const statusLabel = { draft: "Draft (hidden)", current: "Current (public)", archived: "Archived" };

const iconBtn =
  "p-2 rounded-lg text-slate-400 hover:text-blue-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent";

export default function HierarchyEditorPage() {
  const { call, can } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tree, setTree] = useState<HierarchyTree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<
    | { kind: "season" }
    | { kind: "position"; parentId: string | null }
    | { kind: "rename"; position: HierarchyPosition }
    | { kind: "renameSeason" }
    | null
  >(null);

  const loadSeasons = useCallback(async () => {
    const list = await call<Season[]>("/admin/seasons");
    setSeasons(list);
    setSelected((cur) =>
      cur && list.some((s) => s.id === cur)
        ? cur
        : (list.find((s) => s.status === "draft") ?? list.find((s) => s.status === "current") ?? list[0])
            ?.id ?? null,
    );
  }, [call]);

  const loadTree = useCallback(async () => {
    if (!selected) return setTree(null);
    setTree(await call<HierarchyTree>(`/admin/seasons/${selected}/hierarchy`));
  }, [call, selected]);

  useEffect(() => {
    loadSeasons().catch((e: Error) => setError(e.message));
    call<Person[]>("/admin/seasons/people").then(setPeople, () => undefined);
  }, [call, loadSeasons]);

  useEffect(() => {
    loadTree().catch((e: Error) => setError(e.message));
  }, [loadTree]);

  /** Run a change, then refresh. Shows the server's message on failure. */
  const act = async (fn: () => Promise<unknown>, reloadSeasons = false) => {
    setError("");
    try {
      await fn();
      if (reloadSeasons) await loadSeasons();
      await loadTree();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const season = tree?.season;
  const readOnly = season?.status === "archived";
  const kidsOf = useMemo(() => childrenByParent(tree?.positions ?? []), [tree]);

  if (!can("seasons.manage")) {
    return <Empty text="You don't have permission to edit the team hierarchy." />;
  }

  return (
    <>
      <PageTitle
        eyebrow="Our Team page"
        title="Team Hierarchy"
        action={
          <Button variant="accent" onClick={() => setDialog({ kind: "season" })}>
            <Plus size={16} /> New season
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        {seasons.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              s.id === selected
                ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                : "bg-white text-slate-600 hover:text-orange-600"
            }`}
          >
            {s.name}
            {s.status !== "archived" && (
              <span className="ml-2 opacity-70">· {s.status}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <ErrorText error={error} />
      </div>

      {season && (
        <Card className="p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black text-blue-900 uppercase">{season.name}</h3>
              <Badge tone={statusTone[season.status]}>{statusLabel[season.status]}</Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {season.status === "draft" &&
                "Only you can see this season. Publish it to show it on the Our Team page; the current season will move to the archive."}
              {season.status === "current" && "This is the hierarchy visitors see first on the Our Team page."}
              {season.status === "archived" && (
                <span className="inline-flex items-center gap-1.5">
                  <Lock size={14} /> Past seasons are kept as history and can&apos;t be changed.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {season.status !== "draft" && (
              <Link
                href={`/team?season=${season.number}`}
                target="_blank"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-white text-blue-900 hover:text-orange-600 border border-slate-200"
              >
                <ExternalLink size={14} /> View page
              </Link>
            )}
            {!readOnly && (
              <Button variant="ghost" onClick={() => setDialog({ kind: "renameSeason" })}>
                <Pencil size={14} /> Rename
              </Button>
            )}
            {season.status === "draft" && (
              <>
                <Button
                  variant="accent"
                  onClick={() =>
                    confirm(
                      `Publish ${season.name}? It becomes the current season on the Our Team page, and the current one is archived (read-only).`,
                    ) && void act(() => call(`/admin/seasons/${season.id}/publish`, { method: "POST" }), true)
                  }
                >
                  <Rocket size={14} /> Publish
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    confirm(`Delete the draft ${season.name}? This can't be undone.`) &&
                    void act(async () => {
                      await call(`/admin/seasons/${season.id}`, { method: "DELETE" });
                      setSelected(null);
                    }, true)
                  }
                >
                  <Trash2 size={14} /> Delete draft
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {tree &&
        (tree.positions.length === 0 ? (
          <Empty text="No positions yet. Add the first one (for example “President”)." />
        ) : (
          <div className="space-y-4">
            {kidsOf(null).map((p) => (
              <PositionEditor
                key={p.id}
                position={p}
                kidsOf={kidsOf}
                people={people}
                readOnly={readOnly}
                act={act}
                onAddChild={(parentId) => setDialog({ kind: "position", parentId })}
                onRename={(position) => setDialog({ kind: "rename", position })}
              />
            ))}
          </div>
        ))}

      {tree && !readOnly && (
        <Button
          variant="ghost"
          className="mt-6"
          onClick={() => setDialog({ kind: "position", parentId: null })}
        >
          <Plus size={14} /> Add top-level position
        </Button>
      )}

      {dialog?.kind === "season" && (
        <NewSeasonDialog
          seasons={seasons}
          onClose={() => setDialog(null)}
          onCreated={async (id) => {
            setDialog(null);
            await loadSeasons();
            setSelected(id);
          }}
        />
      )}
      {dialog?.kind === "position" && season && (
        <TextDialog
          title={dialog.parentId ? "Add sub-position" : "Add top-level position"}
          label="Position title"
          placeholder="e.g. Vice President Technical"
          onClose={() => setDialog(null)}
          onSubmit={(title) =>
            call(`/admin/seasons/${season.id}/positions`, {
              method: "POST",
              body: JSON.stringify({ title, parentId: dialog.parentId ?? undefined }),
            }).then(() => {
              setDialog(null);
              void loadTree();
            })
          }
        />
      )}
      {dialog?.kind === "rename" && (
        <TextDialog
          title="Rename position"
          label="Position title"
          initial={dialog.position.title}
          onClose={() => setDialog(null)}
          onSubmit={(title) =>
            call(`/admin/positions/${dialog.position.id}`, {
              method: "PATCH",
              body: JSON.stringify({ title }),
            }).then(() => {
              setDialog(null);
              void loadTree();
            })
          }
        />
      )}
      {dialog?.kind === "renameSeason" && season && (
        <TextDialog
          title="Rename season"
          label="Season name"
          initial={season.name}
          onClose={() => setDialog(null)}
          onSubmit={(name) =>
            call(`/admin/seasons/${season.id}`, {
              method: "PATCH",
              body: JSON.stringify({ name }),
            }).then(async () => {
              setDialog(null);
              await loadSeasons();
              await loadTree();
            })
          }
        />
      )}
    </>
  );
}

function PositionEditor({
  position,
  kidsOf,
  people,
  readOnly,
  act,
  onAddChild,
  onRename,
}: {
  position: HierarchyPosition;
  kidsOf: (id: string | null) => HierarchyPosition[];
  people: Person[];
  readOnly: boolean;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  onAddChild: (parentId: string) => void;
  onRename: (p: HierarchyPosition) => void;
}) {
  const { call } = useAuth();
  const kids = kidsOf(position.id);
  const taken = new Set(position.members.map((m) => m.userId));
  const available = people.filter((p) => !taken.has(p.id));
  const post = (path: string, body?: object) =>
    call(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

  return (
    <div>
      <Card className="p-5 border-l-8 border-l-orange-600">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <h4 className="font-black text-blue-900 uppercase tracking-tight">{position.title}</h4>
          {!readOnly && (
            <div className="flex items-center gap-1">
              <button className={iconBtn} aria-label="Move up" onClick={() => void act(() => post(`/admin/positions/${position.id}/move`, { direction: "up" }))}>
                <ArrowUp size={16} />
              </button>
              <button className={iconBtn} aria-label="Move down" onClick={() => void act(() => post(`/admin/positions/${position.id}/move`, { direction: "down" }))}>
                <ArrowDown size={16} />
              </button>
              <button className={iconBtn} aria-label="Rename position" onClick={() => onRename(position)}>
                <Pencil size={16} />
              </button>
              <button className={iconBtn} aria-label="Add sub-position" onClick={() => onAddChild(position.id)}>
                <Plus size={16} />
              </button>
              <button
                className={`${iconBtn} hover:!text-red-600 hover:!bg-red-50`}
                aria-label="Delete position"
                onClick={() =>
                  confirm(
                    `Delete "${position.title}"${kids.length ? " and every position under it" : ""}?`,
                  ) && void act(() => call(`/admin/positions/${position.id}`, { method: "DELETE" }))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {position.members.length === 0 && (
            <span className="text-sm text-slate-400">Nobody assigned yet.</span>
          )}
          {position.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <Avatar name={m.name} url={m.avatarUrl} />
              <span className="text-sm font-bold text-slate-800 pr-1">{m.name}</span>
              {m.linkedinUrl && (
                <a
                  href={m.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${m.name} on LinkedIn`}
                  className="shrink-0"
                >
                  <Linkedin size={16} fill="currentColor" className="text-white bg-blue-700 rounded-sm p-0.5" />
                </a>
              )}
              {!m.userId && <Badge tone="slate">No account</Badge>}
              {!readOnly && position.members.length > 1 && (
                <>
                  <button className={iconBtn} aria-label={`Move ${m.name} left`} onClick={() => void act(() => post(`/admin/position-members/${m.id}/move`, { direction: "up" }))}>
                    <ArrowUp size={14} className="-rotate-90" />
                  </button>
                  <button className={iconBtn} aria-label={`Move ${m.name} right`} onClick={() => void act(() => post(`/admin/position-members/${m.id}/move`, { direction: "down" }))}>
                    <ArrowDown size={14} className="-rotate-90" />
                  </button>
                </>
              )}
              {!readOnly && (
                <button
                  className={`${iconBtn} hover:!text-red-600`}
                  aria-label={`Remove ${m.name}`}
                  onClick={() => void act(() => call(`/admin/position-members/${m.id}`, { method: "DELETE" }))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <PersonPicker
            people={available}
            label={`Add a person to ${position.title}`}
            onPick={(userId) =>
              void act(() => post(`/admin/positions/${position.id}/members`, { userId }))
            }
          />
        )}
      </Card>

      {kids.length > 0 && (
        <div className="ml-4 md:ml-8 pl-4 md:pl-6 border-l-2 border-slate-200 mt-4 space-y-4">
          {kids.map((k) => (
            <PositionEditor
              key={k.id}
              position={k}
              kidsOf={kidsOf}
              people={people}
              readOnly={readOnly}
              act={act}
              onAddChild={onAddChild}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewSeasonDialog({
  seasons,
  onClose,
  onCreated,
}: {
  seasons: Season[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { call } = useAuth();
  const latest = seasons.reduce<Season | null>((a, s) => (!a || s.number > a.number ? s : a), null);
  const [number, setNumber] = useState(String((latest?.number ?? 26) + 1));
  const [copyFrom, setCopyFrom] = useState(latest?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const s = await call<Season>("/admin/seasons", {
        method: "POST",
        body: JSON.stringify({
          number: Number(number),
          copyFromSeasonId: copyFrom || undefined,
        }),
      });
      onCreated(s.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New season" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Season number" id="s-number">
          <input
            id="s-number"
            type="number"
            min={1}
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Start from" id="s-copy">
          <select id="s-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={inputCls}>
            <option value="">An empty hierarchy</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}&apos;s positions (titles only, no people)
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          The new season starts as a hidden draft. Add people, then publish it when it&apos;s ready.
        </p>
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Creating…" : "Create season"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TextDialog({
  title,
  label,
  initial = "",
  placeholder,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSubmit(value.trim());
          } catch (err) {
            setError((err as Error).message);
            setBusy(false);
          }
        }}
      >
        <Field label={label} id="t-value">
          <input
            id="t-value"
            autoFocus
            required
            minLength={2}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            className={inputCls}
          />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
