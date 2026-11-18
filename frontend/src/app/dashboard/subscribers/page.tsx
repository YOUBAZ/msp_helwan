"use client";

import { useEffect, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button, Card, Empty, ErrorText, fmtDate, PageTitle } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import type { Subscriber } from "@/lib/types";

export default function SubscribersPage() {
  const { call, can } = useAuth();
  const [items, setItems] = useState<Subscriber[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    call<Subscriber[]>("/admin/subscribers").then(setItems, (e: Error) => setError(e.message));
  }, [call]);

  async function remove(id: string) {
    if (!confirm("Remove this subscriber?")) return;
    try {
      await call(`/admin/subscribers/${id}`, { method: "DELETE" });
      setItems((l) => l?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="Newsletter"
        title="Subscribers"
        action={
          items && items.length > 0 ? (
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(items.map((s) => s.email).join(", "));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {}
              }}
            >
              <Copy size={16} /> {copied ? "Copied" : "Copy all emails"}
            </Button>
          ) : undefined
        }
      />
      <ErrorText error={error} />
      {!items ? null : items.length === 0 ? (
        <Empty text="No subscribers yet." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {items.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 px-6 py-4">
              <span className="text-slate-800 font-bold break-all">{s.email}</span>
              <div className="flex items-center gap-4 shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
                  {fmtDate(s.createdAt)}
                </span>
                {can("subscribers.delete") && (
                  <button
                    onClick={() => remove(s.id)}
                    aria-label="Remove subscriber"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
