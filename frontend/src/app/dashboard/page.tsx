"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Mail, MessageSquare, Trash2 } from "lucide-react";
import AccentBar from "@/components/AccentBar";
import { api, TOKEN_KEY } from "@/lib/api";

type Message = { id: string; name: string; email: string; message: string; createdAt: string };
type Subscriber = { id: string; email: string; createdAt: string };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<string>("");
  const [tab, setTab] = useState<"messages" | "subscribers">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let t: string | null = null;
    try {
      t = localStorage.getItem(TOKEN_KEY);
    } catch {}
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
    Promise.all([
      api<{ email: string }>("/auth/me", { token: t }),
      api<Message[]>("/admin/messages", { token: t }),
      api<Subscriber[]>("/admin/subscribers", { token: t }),
    ])
      .then(([user, m, s]) => {
        setMe(user.email);
        setMessages(m);
        setSubscribers(s);
      })
      .catch(() => {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {}
        router.replace("/login");
      });
  }, [router]);

  const logout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    router.push("/login");
  };

  async function remove(kind: "messages" | "subscribers", id: string) {
    try {
      await api(`/admin/${kind}/${id}`, { method: "DELETE", token });
      if (kind === "messages") setMessages((l) => l.filter((x) => x.id !== id));
      else setSubscribers((l) => l.filter((x) => x.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!me) {
    return (
      <section className="py-24 min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading…</p>
      </section>
    );
  }

  const tabBtn = (id: typeof tab, label: string, n: number, Icon: typeof Mail) => (
    <button
      onClick={() => setTab(id)}
      className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
        tab === id
          ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
          : "text-slate-600 bg-white hover:text-orange-600"
      }`}
    >
      <Icon size={16} /> {label} <span className="opacity-60">({n})</span>
    </button>
  );

  return (
    <section className="py-16 md:py-24 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <span className="px-4 py-1 bg-blue-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
              Squad Dashboard
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mt-4 tracking-tighter uppercase italic">
              Inbox
            </h2>
            <AccentBar size="sm" className="!justify-start mt-2" />
            <p className="text-slate-400 text-xs font-bold mt-3">Signed in as {me}</p>
          </div>
          <button
            onClick={logout}
            className="self-start md:self-auto flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-blue-900 text-xs font-black uppercase tracking-widest hover:text-orange-600 shadow"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          {tabBtn("messages", "Messages", messages.length, MessageSquare)}
          {tabBtn("subscribers", "Subscribers", subscribers.length, Mail)}
        </div>

        {error && <p className="text-red-600 text-sm font-bold mb-4">{error}</p>}

        {tab === "messages" ? (
          messages.length === 0 ? (
            <Empty text="No messages yet." />
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="bg-white p-6 md:p-8 rounded-[2rem] shadow-lg border-l-8 border-l-orange-600"
                >
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="min-w-0">
                      <h4 className="font-black text-blue-900 uppercase">{m.name}</h4>
                      <a
                        href={`mailto:${m.email}`}
                        className="text-sm text-slate-500 hover:text-orange-600 break-all"
                      >
                        {m.email}
                      </a>
                    </div>
                    <button
                      onClick={() => remove("messages", m.id)}
                      aria-label="Delete message"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <p className="text-slate-700 whitespace-pre-wrap">{m.message}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                    {fmt(m.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : subscribers.length === 0 ? (
          <Empty text="No subscribers yet." />
        ) : (
          <div className="bg-white rounded-[2rem] shadow-lg divide-y divide-slate-100">
            {subscribers.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <span className="text-slate-800 font-bold break-all">{s.email}</span>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
                    {fmt(s.createdAt)}
                  </span>
                  <button
                    onClick={() => remove("subscribers", s.id)}
                    aria-label="Remove subscriber"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-[2rem] p-12 text-center text-slate-400 font-bold shadow">
      {text}
    </div>
  );
}
