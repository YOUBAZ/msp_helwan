"use client";

import { FormEvent, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import Avatar from "@/components/dashboard/Avatar";
import { Button, Card, ErrorText, Field, inputCls, PageTitle } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import { squareJpeg } from "@/lib/image";

const today = () => new Date().toISOString().slice(0, 10);

function Status({ msg }: { msg: { ok: string; err: string } }) {
  return (
    <>
      <ErrorText error={msg.err} />
      {msg.ok && (
        <p role="status" className="text-green-600 text-sm font-bold">
          {msg.ok}
        </p>
      )}
    </>
  );
}

export default function ProfilePage() {
  const { me, call, refresh, setToken } = useAuth();
  const p = me.profile;

  const [form, setForm] = useState({
    name: me.name,
    phone: p.phone ?? "",
    birthday: p.birthday ?? "",
    gender: p.gender ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    facebookUrl: p.facebookUrl ?? "",
    portfolioUrl: p.portfolioUrl ?? "",
  });
  const [infoMsg, setInfoMsg] = useState({ ok: "", err: "" });
  const [saving, setSaving] = useState(false);

  const [photoMsg, setPhotoMsg] = useState({ ok: "", err: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState({ ok: "", err: "" });

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function saveInfo(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await call("/auth/me", { method: "PATCH", body: JSON.stringify(form) });
      await refresh();
      setInfoMsg({ ok: "Profile saved.", err: "" });
    } catch (err) {
      setInfoMsg({ ok: "", err: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setPhotoMsg({ ok: "", err: "" });
    try {
      const body = new FormData();
      body.append("file", await squareJpeg(file), "avatar.jpg");
      await call("/auth/me/avatar", { method: "POST", body });
      await refresh();
      setPhotoMsg({ ok: "Photo updated.", err: "" });
    } catch (err) {
      setPhotoMsg({ ok: "", err: (err as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!confirm("Remove your profile photo?")) return;
    try {
      await call("/auth/me/avatar", { method: "DELETE" });
      await refresh();
      setPhotoMsg({ ok: "Photo removed.", err: "" });
    } catch (err) {
      setPhotoMsg({ ok: "", err: (err as Error).message });
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

      {!p.complete && (
        <div className="mb-6 p-5 rounded-2xl bg-orange-50 border border-orange-200 text-orange-800 text-sm font-bold">
          Please complete your profile: phone, birthday and gender are required.
        </div>
      )}

      <div className="grid xl:grid-cols-[320px_1fr] gap-6">
        {/* Photo */}
        <Card className="p-8 flex flex-col items-center text-center gap-5 self-start">
          <Avatar name={me.name} url={p.avatarUrl} size="lg" />
          <div>
            <p className="font-black text-blue-900">{me.name}</p>
            <p className="text-sm text-slate-500 break-all">{me.email}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            id="avatar-file"
            onChange={(e) => void uploadPhoto(e.target.files?.[0])}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="accent"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={16} /> {uploading ? "Uploading…" : p.avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {p.avatarUrl && (
              <Button type="button" variant="danger" onClick={() => void removePhoto()}>
                <Trash2 size={16} /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-400">
            JPG, PNG or WebP. It&apos;s cropped to a square automatically.
          </p>
          <Status msg={photoMsg} />
        </Card>

        {/* Personal info */}
        <Card className="p-8">
          <form onSubmit={saveInfo} className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-900">
              Personal information
            </h3>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="Full name *" id="p-name">
                <input
                  id="p-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.name}
                  onChange={set("name")}
                  className={inputCls}
                />
              </Field>
              <Field label="Email" id="p-email">
                <input id="p-email" value={me.email} disabled className={`${inputCls} opacity-70`} />
              </Field>
              <Field label="Phone *" id="p-phone">
                <input
                  id="p-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="+20 100 123 4567"
                  value={form.phone}
                  onChange={set("phone")}
                  className={inputCls}
                />
              </Field>
              <Field label="Birthday *" id="p-birthday">
                <input
                  id="p-birthday"
                  type="date"
                  required
                  min="1925-01-01"
                  max={today()}
                  value={form.birthday}
                  onChange={set("birthday")}
                  className={inputCls}
                />
              </Field>
              <Field label="Gender *" id="p-gender">
                <select
                  id="p-gender"
                  required
                  value={form.gender}
                  onChange={set("gender")}
                  className={inputCls}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>

            <h3 className="text-xs font-black uppercase tracking-widest text-blue-900 pt-2">
              Links (optional)
            </h3>
            <div className="grid md:grid-cols-2 gap-5">
              <Field label="LinkedIn profile" id="p-linkedin">
                <input
                  id="p-linkedin"
                  placeholder="linkedin.com/in/your-name"
                  value={form.linkedinUrl}
                  onChange={set("linkedinUrl")}
                  className={inputCls}
                />
              </Field>
              <Field label="Facebook profile" id="p-facebook">
                <input
                  id="p-facebook"
                  placeholder="facebook.com/your-name"
                  value={form.facebookUrl}
                  onChange={set("facebookUrl")}
                  className={inputCls}
                />
              </Field>
              <Field label="Portfolio / website" id="p-portfolio">
                <input
                  id="p-portfolio"
                  placeholder="your-site.com"
                  value={form.portfolioUrl}
                  onChange={set("portfolioUrl")}
                  className={inputCls}
                />
              </Field>
            </div>
            <Status msg={infoMsg} />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Password */}
      <Card className="p-8 mt-6">
        <form onSubmit={savePassword} className="space-y-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-blue-900">
            Change password
          </h3>
          <div className="grid md:grid-cols-3 gap-5">
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
          </div>
          <Status msg={pwMsg} />
          <Button type="submit">Change password</Button>
        </form>
      </Card>
    </>
  );
}
