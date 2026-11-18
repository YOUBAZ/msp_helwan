import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell, Clock, Lock, MessageSquare } from "lucide-react";
import AccentBar from "@/components/AccentBar";

export const metadata: Metadata = { title: "Join Us" };

const nextSteps = [
  <>Our HR team is currently reviewing all submitted applications.</>,
  <>
    Shortlisted candidates will be contacted via <b>WhatsApp/Email</b> for interviews.
  </>,
  <>General Member recruitment will be announced very soon!</>,
];

export default function RegisterPage() {
  return (
    <section className="py-20 bg-slate-50 min-h-screen flex items-center justify-center font-sans relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-blue-900 to-orange-600" />
      <div className="container mx-auto px-4 max-w-2xl relative z-10">
        <div className="bg-white p-10 md:p-16 rounded-[4rem] shadow-2xl border border-slate-200 text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="relative mx-auto w-28 h-28">
            <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-20" />
            <div className="relative bg-slate-900 w-28 h-28 rounded-full flex items-center justify-center shadow-inner">
              <Lock className="text-orange-500" size={48} />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              Recruitment <br />
              <span className="text-red-600">Is Closed</span>
            </h2>
            <AccentBar size="sm" />
          </div>

          <div className="space-y-6">
            <p className="text-slate-600 font-medium text-lg leading-relaxed">
              Thank you for your interest in joining <b>MSP Tech Club Season 27</b>. The application
              window for <b>Board Members (Heads &amp; Vices)</b> is now officially closed.
            </p>
            <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 text-left space-y-4">
              <h4 className="text-xs font-black text-blue-900 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} /> What happens next?
              </h4>
              <ul className="space-y-3">
                {nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-slate-500">
                    <div className="mt-1 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-4">
            <Link
              href="/"
              className="w-full bg-blue-900 text-white py-5 rounded-3xl font-black text-lg hover:bg-orange-600 transition-all shadow-xl flex items-center justify-center gap-2 group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              BACK TO HOME
            </Link>
            <div className="flex items-center justify-center gap-6 text-slate-400 font-bold text-xs uppercase tracking-widest">
              <span className="flex items-center gap-1.5">
                <Bell size={14} /> Stay Tuned
              </span>
              <span className="w-1 h-1 bg-slate-300 rounded-full" />
              <span className="flex items-center gap-1.5">
                <MessageSquare size={14} /> Check Socials
              </span>
            </div>
          </div>
        </div>
        <p className="mt-12 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">
          MSP Tech Club - Capital University © 2026 | Season 27
        </p>
      </div>
    </section>
  );
}
