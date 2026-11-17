"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

const inputCls =
  "w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-900 outline-none";
const labelCls = "text-xs font-black uppercase tracking-widest text-slate-400";

export default function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await api<{ message: string }>("/contact", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setStatus("ok");
      setFeedback(res.message);
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setStatus("error");
      setFeedback((err as Error).message);
    }
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="c-name" className={labelCls}>
            Your Name
          </label>
          <input
            id="c-name"
            name="name"
            type="text"
            required
            minLength={2}
            value={form.name}
            onChange={update}
            className={inputCls}
            placeholder="Full Name"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="c-email" className={labelCls}>
            Your Email
          </label>
          <input
            id="c-email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={update}
            className={inputCls}
            placeholder="Email Address"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="c-message" className={labelCls}>
          Message
        </label>
        <textarea
          id="c-message"
          name="message"
          rows={4}
          required
          minLength={5}
          value={form.message}
          onChange={update}
          className={inputCls}
          placeholder="How can we help?"
        />
      </div>
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-blue-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl disabled:opacity-60"
      >
        {status === "loading" ? "Sending..." : "Send Message"}
      </button>
      {feedback && (
        <p
          role="status"
          className={`text-center text-sm font-bold ${
            status === "ok" ? "text-green-600" : "text-red-600"
          }`}
        >
          {feedback}
        </p>
      )}
    </form>
  );
}
