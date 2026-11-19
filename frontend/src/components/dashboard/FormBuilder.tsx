"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, Lock, Plus, Save, Trash2, X } from "lucide-react";
import FormFields from "@/components/events/FormFields";
import { Button, Card, Checkbox, ErrorText, inputCls, labelCls, Modal } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";
import type { AdminEvent, Answers, Question, QuestionType } from "@/lib/types";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "short", label: "Short answer" },
  { value: "paragraph", label: "Paragraph" },
  { value: "choice", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "dropdown", label: "Dropdown" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "link", label: "Link" },
];
const isChoice = (t: QuestionType) => t === "choice" || t === "checkboxes" || t === "dropdown";
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);
const MAX_QUESTIONS = 30;

/** Google-Forms-style editor for an event's registration form. */
export default function FormBuilder({ event, onSaved }: { event: AdminEvent; onSaved: () => void }) {
  const { call } = useAuth();
  const [questions, setQuestions] = useState<Question[]>(event.form);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const [busy, setBusy] = useState(false);
  const answered = new Set(event.answeredQuestionIds ?? []);

  const update = (next: Question[]) => {
    setQuestions(next);
    setDirty(true);
    setMsg({ ok: "", err: "" });
  };
  const patch = (i: number, p: Partial<Question>) => update(questions.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...questions];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update(next);
  };
  const add = () =>
    update([...questions, { id: newId(), type: "short", title: "", required: false }]);
  const duplicate = (i: number) =>
    update([...questions.slice(0, i + 1), { ...questions[i], id: newId(), title: `${questions[i].title} (copy)` }, ...questions.slice(i + 1)]);
  const remove = (i: number) => {
    const q = questions[i];
    if (answered.has(q.id) && !confirm(`Delete "${q.title}"? People already answered it: their answers stay in the CSV.`)) return;
    update(questions.filter((_, j) => j !== i));
  };
  const setType = (i: number, type: QuestionType) => {
    const q = questions[i];
    patch(i, {
      type,
      options: isChoice(type) ? (q.options?.length ? q.options : ["Option 1"]) : undefined,
      other: isChoice(type) ? q.other : undefined,
      driveOnly: type === "link" ? q.driveOnly : undefined,
    });
  };

  async function save() {
    setBusy(true);
    setMsg({ ok: "", err: "" });
    try {
      const r = await call<{ form: Question[] }>(`/admin/events/${event.id}/form`, {
        method: "PUT",
        body: JSON.stringify({ questions }),
      });
      setQuestions(r.form);
      setDirty(false);
      setMsg({ ok: "Form saved. Students see it on the event page now.", err: "" });
      onSaved();
    } catch (e) {
      setMsg({ ok: "", err: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-5 md:p-6 space-y-3">
        <p className="text-sm text-slate-600">
          Build what students fill in to register. <b>Full name</b> and <b>Email</b> are always asked first: the email
          receives the ticket and stops double sign-ups.
        </p>
        {["Full name", "Email"].map((t) => (
          <div key={t} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 text-slate-500 text-sm font-bold">
            <Lock size={14} /> {t} <span className="text-orange-600">*</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest">Always on the form</span>
          </div>
        ))}
      </Card>

      {questions.map((q, i) => {
        const locked = answered.has(q.id);
        return (
          <Card key={q.id} className="p-5 md:p-6 space-y-4">
            <div className="grid md:grid-cols-[1fr_200px] gap-3">
              <label className="space-y-1.5">
                <span className={labelCls}>Question {i + 1}</span>
                <input
                  value={q.title}
                  maxLength={200}
                  placeholder="Question"
                  onChange={(e) => patch(i, { title: e.target.value })}
                  className={inputCls}
                />
              </label>
              <label className="space-y-1.5">
                <span className={labelCls}>Type</span>
                <select
                  value={q.type}
                  disabled={locked}
                  title={locked ? "People already answered this question, so its type can't change." : undefined}
                  onChange={(e) => setType(i, e.target.value as QuestionType)}
                  className={`${inputCls} disabled:opacity-60`}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {locked && <span className="block text-[11px] text-slate-500">Answered already: type locked.</span>}
              </label>
            </div>
            <label className="space-y-1.5 block">
              <span className={labelCls}>Help text (optional)</span>
              <input
                value={q.help ?? ""}
                maxLength={500}
                placeholder="Shown under the question"
                onChange={(e) => patch(i, { help: e.target.value || undefined })}
                className={inputCls}
              />
            </label>

            {isChoice(q.type) && (
              <div className="space-y-2">
                <span className={labelCls}>Options</span>
                {(q.options ?? []).map((o, k) => (
                  <div key={k} className="flex gap-2">
                    <input
                      value={o}
                      maxLength={100}
                      aria-label={`Option ${k + 1}`}
                      onChange={(e) => patch(i, { options: q.options!.map((x, m) => (m === k ? e.target.value : x)) })}
                      className={inputCls}
                    />
                    <button
                      type="button"
                      aria-label={`Remove option ${k + 1}`}
                      disabled={(q.options ?? []).length <= 1}
                      onClick={() => patch(i, { options: q.options!.filter((_, m) => m !== k) })}
                      className="p-3 rounded-xl text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={(q.options ?? []).length >= 30}
                    onClick={() => patch(i, { options: [...(q.options ?? []), `Option ${(q.options ?? []).length + 1}`] })}
                  >
                    <Plus size={14} /> Add option
                  </Button>
                </div>
                <Checkbox checked={!!q.other} onChange={(v) => patch(i, { other: v || undefined })} label={'Add "Other" with a text box'} />
              </div>
            )}

            {q.type === "link" && (
              <Checkbox
                checked={!!q.driveOnly}
                onChange={(v) => patch(i, { driveOnly: v || undefined })}
                label="Google Drive links only"
                hint="Students must paste a drive.google.com or docs.google.com link (shared as 'Anyone with the link')."
              />
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <Checkbox checked={q.required} onChange={(v) => patch(i, { required: v })} label="Required" />
              <div className="ml-auto flex gap-1">
                <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={16} />
                </IconBtn>
                <IconBtn label="Move down" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={16} />
                </IconBtn>
                <IconBtn label="Duplicate" disabled={questions.length >= MAX_QUESTIONS} onClick={() => duplicate(i)}>
                  <Copy size={16} />
                </IconBtn>
                <IconBtn label="Delete" danger onClick={() => remove(i)}>
                  <Trash2 size={16} />
                </IconBtn>
              </div>
            </div>
          </Card>
        );
      })}

      <div className="flex flex-wrap gap-3 items-center">
        <Button type="button" variant="ghost" disabled={questions.length >= MAX_QUESTIONS} onClick={add}>
          <Plus size={16} /> Add question
        </Button>
        <Button type="button" variant="ghost" onClick={() => setPreview(true)}>
          <Eye size={16} /> Preview
        </Button>
        <Button type="button" variant="accent" disabled={busy || !dirty} onClick={() => void save()}>
          <Save size={16} /> {busy ? "Saving…" : "Save form"}
        </Button>
        {dirty && <span className="text-xs font-bold text-orange-600">Unsaved changes</span>}
      </div>
      <ErrorText error={msg.err} />
      {msg.ok && (
        <p role="status" className="text-green-700 text-sm font-bold">
          {msg.ok}
        </p>
      )}

      {preview && (
        <Modal title="Preview" onClose={() => setPreview(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("This is a preview: nothing was sent.");
            }}
            className="grid sm:grid-cols-2 gap-4"
          >
            <label className="space-y-1.5 sm:col-span-2 block">
              <span className={labelCls}>
                Full name <span className="text-orange-600">*</span>
              </span>
              <input required className={inputCls} />
            </label>
            <label className="space-y-1.5 sm:col-span-2 block">
              <span className={labelCls}>
                Email <span className="text-orange-600">*</span>
              </span>
              <input required type="email" className={inputCls} />
            </label>
            <FormFields form={questions} answers={previewAnswers} onChange={setPreviewAnswers} idPrefix="preview" />
            <button
              type="submit"
              className="sm:col-span-2 w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm"
            >
              Get my ticket
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function IconBtn({
  label,
  danger,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`p-2.5 rounded-xl text-slate-500 disabled:opacity-30 ${danger ? "hover:text-red-600 hover:bg-red-50" : "hover:text-blue-900 hover:bg-slate-100"}`}
    />
  );
}
