"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorText,
  Field,
  inputCls,
  labelCls,
  Modal,
  PageTitle,
} from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import type { Member, PermissionDef, Role } from "@/lib/types";

export default function RolesPage() {
  const { call, can } = useAuth();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [catalog, setCatalog] = useState<PermissionDef[]>([]);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        call<Role[]>("/roles"),
        call<PermissionDef[]>("/permissions"),
      ]);
      setRoles(r);
      setCatalog(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(role: Role) {
    if (
      !confirm(
        `Delete the "${role.name}" role? ${role.memberCount} member(s) will lose its permissions.`,
      )
    )
      return;
    try {
      await call(`/roles/${role.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const manage = can("roles.manage");
  const label = (key: string) => catalog.find((p) => p.key === key)?.label ?? key;

  return (
    <>
      <PageTitle
        eyebrow="Access control"
        title="Roles"
        action={
          manage && (
            <Button variant="accent" onClick={() => setEditing("new")}>
              <Plus size={16} /> New role
            </Button>
          )
        }
      />
      <div className="mb-4">
        <ErrorText error={error} />
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {roles?.map((r) => (
          <Card
            key={r.id}
            className={`p-6 md:p-8 border-t-8 ${r.isSystem ? "border-orange-600" : "border-blue-900"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">
                    {r.name}
                  </h3>
                  {r.isSystem && (
                    <Badge tone="orange">
                      <Lock size={10} className="inline -mt-0.5" /> Protected
                    </Badge>
                  )}
                </div>
                {r.description && <p className="text-sm text-slate-500 mt-1">{r.description}</p>}
              </div>
              <span className="flex items-center gap-1 text-xs font-black text-slate-400 shrink-0">
                <Users size={14} /> {r.memberCount}
              </span>
            </div>
            <ul className="mt-5 space-y-1.5 text-sm text-slate-700">
              {r.isSystem ? (
                <li className="font-bold">Every permission, always.</li>
              ) : r.permissions.length === 0 ? (
                <li className="text-slate-400">No special permissions (dashboard and profile only).</li>
              ) : (
                r.permissions.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-orange-600">•</span> {label(p)}
                  </li>
                ))
              )}
            </ul>
            {manage && !r.isSystem && (
              <div className="flex gap-2 mt-6">
                <Button variant="ghost" onClick={() => setEditing(r)}>
                  <Pencil size={14} /> Edit
                </Button>
                <Button variant="danger" onClick={() => void remove(r)}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
            )}
            {manage && r.isSystem && (
              <div className="mt-6">
                <Button variant="ghost" onClick={() => setEditing(r)}>
                  <Users size={14} /> Members
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {editing && (
        <RoleEditor
          role={editing === "new" ? null : editing}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function RoleEditor({
  role,
  catalog,
  onClose,
  onSaved,
}: {
  role: Role | null;
  catalog: PermissionDef[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { call, can } = useAuth();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const system = !!role?.isSystem;
  const canListMembers = can("members.view");

  useEffect(() => {
    if (!canListMembers) return;
    void call<Member[]>("/members").then(setMembers, () => undefined);
    if (role) void call<string[]>(`/roles/${role.id}/members`).then(setMemberIds, () => undefined);
  }, [call, role, canListMembers]);

  const groups = [...new Set(catalog.map((p) => p.group))];

  async function save() {
    setBusy(true);
    setError("");
    try {
      let id = role?.id;
      if (!system) {
        const body = JSON.stringify({ name, description, permissions: perms });
        const saved = role
          ? await call<Role>(`/roles/${role.id}`, { method: "PATCH", body })
          : await call<Role>("/roles", { method: "POST", body });
        id = saved.id;
      }
      if (canListMembers && id) {
        await call(`/roles/${id}/members`, {
          method: "PUT",
          body: JSON.stringify({ userIds: memberIds }),
        });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={role ? `Edit role: ${role.name}` : "New role"} onClose={onClose}>
      <div className="space-y-6">
        {!system && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Role name" id="r-name">
                <input
                  id="r-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Head of Media"
                  className={inputCls}
                />
              </Field>
              <Field label="Description (optional)" id="r-desc">
                <input
                  id="r-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="space-y-4">
              <p className={labelCls}>Permissions</p>
              {groups.map((g) => (
                <div key={g}>
                  <p className="text-xs font-black text-blue-900 uppercase tracking-widest mb-2">{g}</p>
                  <div className="grid gap-2">
                    {catalog
                      .filter((p) => p.group === g)
                      .map((p) => (
                        <Checkbox
                          key={p.key}
                          checked={perms.includes(p.key)}
                          disabled={!can(p.key)}
                          onChange={(on) =>
                            setPerms(on ? [...perms, p.key] : perms.filter((x) => x !== p.key))
                          }
                          label={p.label}
                          hint={can(p.key) ? undefined : "You don't have this permission yourself"}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {canListMembers && (
          <div className="space-y-2">
            <p className={labelCls}>People with this role</p>
            <div className="max-h-64 overflow-y-auto grid sm:grid-cols-2 gap-2 pr-1">
              {members
                .filter((m) => m.status === "active" || memberIds.includes(m.id))
                .map((m) => (
                  <Checkbox
                    key={m.id}
                    checked={memberIds.includes(m.id)}
                    onChange={(on) =>
                      setMemberIds(on ? [...memberIds, m.id] : memberIds.filter((x) => x !== m.id))
                    }
                    label={m.name}
                    hint={m.email}
                  />
                ))}
            </div>
          </div>
        )}
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || (!system && name.trim().length < 2)}>
            {busy ? "Saving…" : role ? "Save changes" : "Create role"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
