"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Linkedin } from "@/components/BrandIcons";
import Avatar from "./Avatar";

export type PickablePerson = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  linkedinUrl: string | null;
};

/** Searchable list of accounts showing each person's photo and name. */
export default function PersonPicker({
  people,
  label,
  onPick,
}: {
  people: PickablePerson[];
  label: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const shown = people.filter((p) =>
    `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div ref={box} className="relative mt-4">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest bg-white text-blue-900 hover:text-orange-600 border border-slate-200"
      >
        <UserPlus size={14} /> Add person
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search size={16} className="text-slate-400 ml-2 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search members…"
              aria-label="Search members"
              className="w-full py-2 pr-2 outline-none text-sm"
            />
          </div>
          <ul role="listbox" aria-label={label} className="max-h-72 overflow-y-auto py-1">
            {shown.length === 0 && (
              <li className="px-4 py-3 text-sm text-slate-400">
                {people.length === 0
                  ? "Everyone with an account is already in this position."
                  : "No matching members."}
              </li>
            )}
            {shown.map((p) => (
              <li key={p.id} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => {
                    onPick(p.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 text-left"
                >
                  <Avatar name={p.name} url={p.avatarUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-800 truncate">{p.name}</span>
                    <span className="block text-xs text-slate-400 truncate">{p.email}</span>
                  </span>
                  {p.linkedinUrl && (
                    <Linkedin size={16} fill="currentColor" className="text-white bg-blue-700 rounded-sm p-0.5 shrink-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-100">
            Only people with an active account are listed. Invite others from Members first.
          </p>
        </div>
      )}
    </div>
  );
}
