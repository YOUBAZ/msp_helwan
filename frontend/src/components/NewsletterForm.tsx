"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/lib/api";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await api<{ message: string }>("/newsletter", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setStatus("ok");
      setMessage(res.message);
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }

  return (
    <>
      <form className="relative group" onSubmit={onSubmit}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          aria-label="Email address"
          className="w-full bg-white/5 border border-white/10 px-5 py-4 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-600 transition-all"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          aria-label="Subscribe"
          className="absolute right-2 top-2 bg-orange-600 p-2 rounded-xl text-white hover:bg-white hover:text-orange-600 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-60"
        >
          <Send size={18} />
        </button>
      </form>
      {message && (
        <p
          role="status"
          className={`mt-3 text-xs font-bold ${
            status === "ok" ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </>
  );
}
