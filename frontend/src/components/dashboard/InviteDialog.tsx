"use client";

import { FormEvent, useState } from "react";
import RolePicker from "@/components/dashboard/RolePicker";
import { Button, ErrorText, Field, inputCls, labelCls, Modal } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";

/** Invite someone to create an account with the chosen roles (needs "members.invite"). */
export default function InviteDialog({
  roles,
  onClose,
  onCreated,
  initial,
  title = "Invite a member",
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (link: string, email: string, emailSent: boolean) => void;
  /** Pre-fill, e.g. from an event registration. */
  initial?: { name: string; email: string };
  title?: string;
}) {
  const { call } = useAuth();
  const member = roles.find((r) => r.name === "Member");
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    roleIds: member ? [member.id] : [],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await call<{ link: string; emailSent: boolean }>("/invites", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated(res.link, form.email, res.emailSent);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
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
