"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Pencil, UserPlus, X } from "lucide-react";
import RolePicker from "@/components/dashboard/RolePicker";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorText,
  Field,
  fmtDate,
  inputCls,
  labelCls,
  LinkBox,
  Modal,
  PageTitle,
} from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import type { Invite, Member, Role } from "@/lib/types";

type Dialog =
  | { kind: "invite" }
  | { kind: "link"; title: string; link: string; note: string }
  | { kind: "roles"; member: Member }
  | null;

export default function MembersPage() {
  const { me, call, can } = useAuth();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const [m, r, i] = await Promise.all([
        call<Member[]>("/members"),
        call<Role[]>("/roles"),
        can("members.invite") ? call<Invite[]>("/invites") : Promise.resolve([]),
      ]);
      setMembers(m);
      setRoles(r);
      setInvites(i);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, can]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleStatus = (m: Member) => {
    const next = m.status === "active" ? "disabled" : "active";
    if (next === "disabled" && !confirm(`Disable ${m.name}? They will be signed out immediately.`))
      return;
    void act(() =>
      call(`/members/${m.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }),
    );
  };

  const resetLink = (m: Member) =>
    act(async () => {
      const res = await call<{ link: string }>(`/members/${m.id}/reset-link`, { method: "POST" });
      setDialog({
        kind: "link",
        title: "Password reset link",
        link: res.link,
        note: `Send this to ${m.name}. It works once and expires in 24 hours. Their current sessions end when they use it.`,
      });
    });

  const shown = (members ?? []).filter((m) =>
    `${m.name} ${m.email} ${m.roles.map((r) => r.name).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <>
      <PageTitle
        eyebrow="People"
        title="Members"
        action={
          can("members.invite") && (
            <Button variant="accent" onClick={() => setDialog({ kind: "invite" })}>
              <UserPlus size={16} /> Invite member
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {(["members", "invites"] as const)
          .filter((t) => t === "members" || can("members.invite"))
          .map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                tab === t
                  ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                  : "bg-white text-slate-600 hover:text-orange-600"
              }`}
            >
              {t === "members" ? `Members (${members?.length ?? 0})` : `Pending invites (${invites.length})`}
            </button>
          ))}
        {tab === "members" && (
          <input
            type="search"
            placeholder="Search name, email or role"
            aria-label="Search members"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputCls} sm:max-w-xs sm:ml-auto py-3`}
          />
        )}
      </div>

      <div className="mb-4">
        <ErrorText error={error} />
      </div>

      {tab === "members" ? (
        !members ? null : shown.length === 0 ? (
          <Empty text="No members found." />
        ) : (
          <div className="space-y-3">
            {shown.map((m) => (
              <Card key={m.id} className="p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black text-blue-900">{m.name}</h4>
                      {m.id === me.id && <Badge tone="slate">You</Badge>}
                      {m.status === "disabled" && <Badge tone="red">Disabled</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 break-all">{m.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.roles.length ? (
                        m.roles.map((r) => (
                          <Badge key={r.id} tone={r.name === "President" ? "orange" : "blue"}>
                            {r.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No roles</span>
                      )}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                      Last login: {fmtDate(m.lastLoginAt)}
                    </p>
                  </div>
                  {can("members.manage") && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="ghost" onClick={() => setDialog({ kind: "roles", member: m })}>
                        <Pencil size={14} /> Roles
                      </Button>
                      <Button variant="ghost" onClick={() => void resetLink(m)}>
                        <KeyRound size={14} /> Reset link
                      </Button>
                      {m.id !== me.id && (
                        <Button
                          variant={m.status === "active" ? "danger" : "ghost"}
                          onClick={() => toggleStatus(m)}
                        >
                          {m.status === "active" ? "Disable" : "Enable"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : invites.length === 0 ? (
        <Empty text="No pending invitations." />
      ) : (
        <div className="space-y-3">
          {invites.map((i) => (
            <Card key={i.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-blue-900">{i.name}</h4>
                <p className="text-sm text-slate-500 break-all">{i.email}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {i.roles.map((r) => (
                    <Badge key={r.id}>{r.name}</Badge>
                  ))}
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
                  Invited by {i.invitedBy ?? "—"} · expires {fmtDate(i.expiresAt)}
                </p>
              </div>
              <Button
                variant="danger"
                onClick={() =>
                  confirm(`Cancel the invitation for ${i.email}?`) &&
                  void act(() => call(`/invites/${i.id}`, { method: "DELETE" }))
                }
              >
                <X size={14} /> Cancel invite
              </Button>
            </Card>
          ))}
        </div>
      )}

      {dialog?.kind === "invite" && (
        <InviteDialog
          roles={roles}
          onClose={() => setDialog(null)}
          onCreated={(link, email) => {
            void load();
            setDialog({
              kind: "link",
              title: "Invitation created",
              link,
              note: `Send this link to ${email} (WhatsApp or email). They open it, choose a password, and their account is ready. It works once and expires in 7 days.`,
            });
          }}
        />
      )}
      {dialog?.kind === "roles" && (
        <EditRolesDialog
          member={dialog.member}
          roles={roles}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void load();
          }}
        />
      )}
      {dialog?.kind === "link" && (
        <Modal title={dialog.title} onClose={() => setDialog(null)}>
          <LinkBox link={dialog.link} note={dialog.note} />
        </Modal>
      )}
    </>
  );
}

function InviteDialog({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (link: string, email: string) => void;
}) {
  const { call } = useAuth();
  const member = roles.find((r) => r.name === "Member");
  const [form, setForm] = useState({ name: "", email: "", roleIds: member ? [member.id] : [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await call<{ link: string }>("/invites", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated(res.link, form.email);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Invite a member" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" id="i-name">
            <input
              id="i-name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Email" id="i-email">
            <input
              id="i-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="space-y-2">
          <p className={labelCls}>Roles</p>
          <RolePicker
            roles={roles}
            value={form.roleIds}
            onChange={(roleIds) => setForm({ ...form, roleIds })}
          />
        </div>
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Creating…" : "Create invitation"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditRolesDialog({
  member,
  roles,
  onClose,
  onSaved,
}: {
  member: Member;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { call } = useAuth();
  const [roleIds, setRoleIds] = useState(member.roles.map((r) => r.id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    try {
      await call(`/members/${member.id}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roleIds }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Roles: ${member.name}`} onClose={onClose}>
      <div className="space-y-5">
        <RolePicker roles={roles} value={roleIds} onChange={setRoleIds} />
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save roles"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
