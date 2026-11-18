"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, Empty, ErrorText, fmtDate, PageTitle } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import type { ContactMessage } from "@/lib/types";

export default function InboxPage() {
  const { call, can } = useAuth();
  const [items, setItems] = useState<ContactMessage[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    call<ContactMessage[]>("/admin/messages").then(setItems, (e: Error) => setError(e.message));
  }, [call]);

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    try {
      await call(`/admin/messages/${id}`, { method: "DELETE" });
      setItems((l) => l?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageTitle eyebrow="Contact form" title="Inbox" />
      <ErrorText error={error} />
      {!items ? null : items.length === 0 ? (
        <Empty text="No messages yet." />
      ) : (
        <div className="space-y-4">
          {items.map((m) => (
            <Card key={m.id} className="p-6 md:p-8 border-l-8 border-l-orange-600">
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
                {can("messages.delete") && (
                  <button
                    onClick={() => remove(m.id)}
                    aria-label="Delete message"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">{m.message}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                {fmtDate(m.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
