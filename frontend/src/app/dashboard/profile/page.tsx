"use client";

import { FormEvent, useState } from "react";
import { Button, Card, ErrorText, Field, inputCls, PageTitle } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";

export default function ProfilePage() {
  const { me, call, refresh, setToken } = useAuth();
  const [name, setName] = useState(me.name);
  const [nameMsg, setNameMsg] = useState({ ok: "", err: "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({ ok: "", err: "" });

  async function saveName(e: FormEvent) {
    e.preventDefault();
    try {
      await call("/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
      await refresh();
      setNameMsg({ ok: "Saved.", err: "" });
    } catch (err) {
      setNameMsg({ ok: "", err: (err as Error).message });
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: "", err: "The new passwords don't match." });
      return;
    }
    try {
      const res = await call<{ accessToken: string }>("/auth/me/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      setToken(res.accessToken);
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: "Password changed. Other devices have been signed out.", err: "" });
    } catch (err) {
      setPwMsg({ ok: "", err: (err as Error).message });
    }
  }

  return (
    <>
      <PageTitle eyebrow="Account" title="My Profile" />
      <div className="grid xl:grid-cols-2 gap-6">
        <Card className="p-8">
          <form onSubmit={saveName} className="space-y-5">
            <Field label="Email" id="p-email">
              <input id="p-email" value={me.email} disabled className={`${inputCls} opacity-70`} />
            </Field>
            <Field label="Full name" id="p-name">
              <input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className={inputCls}
              />
            </Field>
            <ErrorText error={nameMsg.err} />
            {nameMsg.ok && <p className="text-green-600 text-sm font-bold">{nameMsg.ok}</p>}
            <Button type="submit">Save name</Button>
          </form>
        </Card>
        <Card className="p-8">
          <form onSubmit={savePassword} className="space-y-5">
            <Field label="Current password" id="p-cur">
              <input
                id="p-cur"
                type="password"
                autoComplete="current-password"
                required
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="New password (8+ characters)" id="p-new">
              <input
                id="p-new"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Confirm new password" id="p-conf">
              <input
                id="p-conf"
                type="password"
                autoComplete="new-password"
                required
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                className={inputCls}
              />
            </Field>
            <ErrorText error={pwMsg.err} />
            {pwMsg.ok && <p className="text-green-600 text-sm font-bold">{pwMsg.ok}</p>}
            <Button type="submit">Change password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
