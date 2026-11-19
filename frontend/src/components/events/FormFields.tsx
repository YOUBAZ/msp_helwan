"use client";

import { useState } from "react";
import type { Answers, Question } from "@/lib/types";

export const DRIVE_HINT = "Make sure the file is shared as 'Anyone with the link'.";

const inputCls =
  "w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-900 outline-none";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-500";
const OTHER = "__other__";

type Props = {
  form: Question[];
  answers: Answers;
  onChange: (a: Answers) => void;
  /** Keeps ids unique when the same form shows twice (e.g. preview). */
  idPrefix: string;
};

/** Renders an event's registration questions; used on the event page and in the dashboard preview. */
export default function FormFields({ form, answers, onChange, idPrefix }: Props) {
  // "Other" choices: whether it's picked, and its text, per question.
  const [otherOn, setOtherOn] = useState<Record<string, boolean>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});

  const set = (id: string, v: string | string[]) => onChange({ ...answers, [id]: v });

  const setOther = (q: Question, on: boolean, text: string) => {
    setOtherOn((o) => ({ ...o, [q.id]: on }));
    setOtherText((t) => ({ ...t, [q.id]: text }));
    if (q.type === "checkboxes") {
      const picked = ((answers[q.id] as string[] | undefined) ?? []).filter((x) => q.options?.includes(x));
      set(q.id, on && text ? [...picked, text] : picked);
    } else {
      set(q.id, on ? text : "");
    }
  };

  return (
    <>
      {form.map((q) => {
        const id = `${idPrefix}-${q.id}`;
        const value = answers[q.id];
        const text = typeof value === "string" ? value : "";
        const other = otherText[q.id] ?? "";
        const label = (
          <span className={labelCls}>
            {q.title}
            {q.required && <span className="text-orange-600"> *</span>}
          </span>
        );
        const help = q.help && <span className="block text-xs text-slate-500">{q.help}</span>;
        const otherBox = (on: boolean, picked: boolean) =>
          picked && (
            <input
              aria-label={`${q.title}: other`}
              required={on}
              maxLength={200}
              placeholder="Please specify"
              value={other}
              onChange={(e) => setOther(q, true, e.target.value)}
              className={`${inputCls} mt-2`}
            />
          );

        if (q.type === "choice" || q.type === "checkboxes") {
          const multi = q.type === "checkboxes";
          const picked = multi ? ((value as string[] | undefined) ?? []) : [];
          return (
            <fieldset key={q.id} className="space-y-2 sm:col-span-2">
              <legend className="mb-1.5">{label}</legend>
              {help}
              {(q.options ?? []).map((o) => (
                <label key={o} className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={id}
                    required={!multi && q.required}
                    checked={multi ? picked.includes(o) : text === o && !otherOn[q.id]}
                    onChange={(e) => {
                      if (multi) {
                        const next = e.target.checked ? [...picked, o] : picked.filter((x) => x !== o);
                        set(q.id, next);
                      } else {
                        setOtherOn((s) => ({ ...s, [q.id]: false }));
                        set(q.id, o);
                      }
                    }}
                    className="w-4 h-4 accent-orange-600"
                  />
                  {o}
                </label>
              ))}
              {q.other && (
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                  <input
                    type={multi ? "checkbox" : "radio"}
                    name={id}
                    required={!multi && q.required}
                    checked={!!otherOn[q.id]}
                    onChange={(e) => setOther(q, multi ? e.target.checked : true, other)}
                    className="w-4 h-4 accent-orange-600"
                  />
                  Other
                </label>
              )}
              {otherBox(true, !!otherOn[q.id])}
            </fieldset>
          );
        }

        if (q.type === "dropdown") {
          const selected = otherOn[q.id] ? OTHER : text;
          return (
            <label key={q.id} htmlFor={id} className="space-y-1.5 sm:col-span-2 block">
              {label}
              {help}
              <select
                id={id}
                required={q.required}
                value={selected}
                onChange={(e) => {
                  if (e.target.value === OTHER) setOther(q, true, other);
                  else {
                    setOtherOn((s) => ({ ...s, [q.id]: false }));
                    set(q.id, e.target.value);
                  }
                }}
                className={inputCls}
              >
                <option value="">Choose…</option>
                {(q.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                {q.other && <option value={OTHER}>Other…</option>}
              </select>
              {otherBox(true, !!otherOn[q.id])}
            </label>
          );
        }

        const common = {
          id,
          required: q.required,
          value: text,
          className: inputCls,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(q.id, e.target.value),
        };
        return (
          <label key={q.id} htmlFor={id} className="space-y-1.5 sm:col-span-2 block">
            {label}
            {help}
            {q.type === "paragraph" ? (
              <textarea {...common} rows={4} maxLength={3000} />
            ) : q.type === "number" ? (
              <input {...common} type="number" step="any" inputMode="decimal" />
            ) : q.type === "date" ? (
              <input {...common} type="date" />
            ) : q.type === "link" ? (
              <input
                {...common}
                type="url"
                maxLength={500}
                placeholder={q.driveOnly ? "https://drive.google.com/…" : "https://…"}
              />
            ) : (
              <input {...common} maxLength={300} />
            )}
            {q.type === "link" && q.driveOnly && (
              <span className="block text-xs text-orange-700 font-bold">Google Drive link. {DRIVE_HINT}</span>
            )}
          </label>
        );
      })}
    </>
  );
}
