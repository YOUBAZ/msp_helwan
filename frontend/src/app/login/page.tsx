"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import { api, TOKEN_KEY } from "@/lib/api";

const inputCls =
  "w-full pl-14 pr-6 py-4 bg-slate-800/50 border border-slate-700 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent transition-all placeholder:text-slate-600";

export default function LoginPage() {
  const router = useRouter();
  const [data, setData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [e.target.name]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      try {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
      } catch {}
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <section className="py-24 bg-white min-h-[80vh] flex items-center">
      <div className="container mx-auto px-6 max-w-xl">
        <div className="mb-10 flex flex-col items-center">
          <Link
            href="/"
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-blue-900 transition-colors text-xs font-black uppercase tracking-widest"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="bg-blue-900 p-4 rounded-[2rem] shadow-xl shadow-blue-900/20 mb-6">
            <ShieldCheck className="text-white" size={40} />
          </div>
          <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
            Board Login
          </h2>
          <AccentBar size="sm" className="mt-2 !gap-1" />
          <p className="text-slate-400 mt-4 font-bold text-xs uppercase tracking-[0.3em]">
            Access Squad Dashboard
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-[#0f172a] p-10 md:p-12 rounded-[3.5rem] shadow-2xl border border-slate-800 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-[50px] -mr-10 -mt-10" />
          <div className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="text-slate-500" size={18} />
                </div>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={data.email}
                  onChange={onChange}
                  className={inputCls}
                  placeholder="name@msphelwan.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-4">
                <label
                  htmlFor="password"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Password
                </label>
                <a
                  href="#"
                  className="text-[10px] font-black text-orange-600 uppercase tracking-widest hover:text-white transition-colors"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="text-slate-500" size={18} />
                </div>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={data.password}
                  onChange={onChange}
                  className={inputCls}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-red-400 text-xs font-bold text-center">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:bg-white hover:text-blue-900 transition-all shadow-xl shadow-orange-600/20 flex items-center justify-center gap-3 group disabled:opacity-60"
            >
              {loading ? "Authorizing..." : "Authorize Login"}{" "}
              <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="mt-10 text-center border-t border-slate-800 pt-8">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
              Authorized Board Members Only
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
