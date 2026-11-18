"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Lock, UserPlus } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import { api } from "@/lib/api";
import { saveToken } from "@/lib/auth";

type LinkInfo = { type: "invite" | "reset"; email: string; name: string };

const inputCls =
  "w-full px-5 py-4 bg-slate-800/50 border border-slate-700 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all placeholder:text-slate-600";
const labelCls = "text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4";

export default function SetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<LinkInfo>(`/auth/links/${encodeURIComponent(token)}`).then(
      (i) => {
        setInfo(i);
        setName(i.name);
      },
      (e: Error) => setLoadError(e.message),
    );
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.password !== pw.confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api<{ accessToken: string }>(`/auth/links/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify(
          info?.type === "invite" ? { name, password: pw.password } : { password: pw.password },
        ),
      });
      saveToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const invite = info?.type === "invite";

  return (
    <section className="py-24 bg-white min-h-[80vh] flex items-center">
      <div className="container mx-auto px-6 max-w-xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="bg-blue-900 p-4 rounded-[2rem] shadow-xl shadow-blue-900/20 mb-6">
            {invite ? (
              <UserPlus className="text-white" size={40} />
            ) : (
              <KeyRound className="text-white" size={40} />
            )}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
            {loadError ? "Link expired" : invite ? "Join the Squad" : "New Password"}
          </h2>
          <AccentBar size="sm" className="mt-2" />
          {info && (
            <p className="text-slate-500 mt-4 font-medium">
              {invite ? "You've been invited to MSP Tech Club as " : "Choose a new password for "}
              <b className="break-all">{info.email}</b>
            </p>
          )}
        </div>

        {loadError ? (
          <div className="bg-slate-50 rounded-[2rem] p-8 text-center space-y-6">
            <p className="text-slate-600">{loadError}</p>
            <Link
              href="/login"
              className="inline-block bg-blue-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-orange-600 transition-all"
            >
              Go to login
            </Link>
          </div>
        ) : !info ? (
          <p className="text-center text-slate-400 font-black uppercase tracking-widest text-xs">
            Checking link…
          </p>
        ) : (
          <form
            onSubmit={submit}
            className="bg-[#0f172a] p-10 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-800 space-y-6"
          >
            {invite && (
              <div className="space-y-2">
                <label htmlFor="sp-name" className={labelCls}>
                  Your full name
                </label>
                <input
                  id="sp-name"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="sp-pw" className={labelCls}>
                Password (8+ characters)
              </label>
              <input
                id="sp-pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={pw.password}
                onChange={(e) => setPw({ ...pw, password: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sp-confirm" className={labelCls}>
                Confirm password
              </label>
              <input
                id="sp-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                className={inputCls}
              />
            </div>
            {error && (
              <p role="alert" className="text-red-400 text-xs font-bold text-center">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-white hover:text-blue-900 transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-3 disabled:opacity-60"
            >
              <Lock size={18} />
              {busy ? "Saving…" : invite ? "Create my account" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
