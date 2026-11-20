"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import AccentBar from "@/components/AccentBar";

export const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "Never";

export function PageTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
      <div>
        <span className="px-4 py-1 bg-blue-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full">
          {eyebrow}
        </span>
        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mt-4 tracking-tighter uppercase italic">
          {title}
        </h2>
        <AccentBar size="sm" className="!justify-start mt-2" />
      </div>
      {action}
    </div>
  );
}

const variants = {
  primary: "bg-blue-900 text-white hover:bg-orange-600 shadow-lg shadow-blue-900/20",
  accent: "bg-orange-600 text-white hover:bg-blue-900 shadow-lg shadow-orange-600/20",
  ghost: "bg-white text-blue-900 hover:text-orange-600 border border-slate-200",
  danger: "bg-white text-red-600 hover:bg-red-600 hover:text-white border border-red-200",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-[2rem] shadow-lg ${className}`}>{children}</div>;
}

export function Badge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: "blue" | "orange" | "green" | "red" | "slate";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-800",
    orange: "bg-orange-50 text-orange-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return <Card className="p-12 text-center text-slate-400 font-bold">{text}</Card>;
}

export function ErrorText({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-red-600 text-sm font-bold">
      {error}
    </p>
  );
}

export const inputCls =
  "w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-900 outline-none text-slate-900";
export const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500";

export function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed border-slate-100"
          : checked
            ? "border-blue-900 bg-blue-50 cursor-pointer"
            : "border-slate-200 hover:border-slate-300 cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-blue-900 shrink-0"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm">
        <span className="font-bold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 md:px-8 pt-6 md:pt-8">
          <h3 className="text-xl md:text-2xl font-black text-blue-900 uppercase tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}

/** Shows a one-time link with a copy button. */
export function LinkBox({ link, note }: { link: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input readOnly value={link} className={`${inputCls} text-xs`} onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          variant="accent"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {}
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}
