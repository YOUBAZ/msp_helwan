"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { navLinks, site } from "@/data/site";
import { readToken } from "@/lib/auth";

export default function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => setSignedIn(!!readToken()), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setIsMenuOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/80 backdrop-blur-lg shadow-lg py-2" : "bg-white py-4"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/logo.jpeg"
                alt={`${site.fullName} logo`}
                className="h-10 w-10 rounded-xl object-cover transform group-hover:rotate-12 transition-transform shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-600 rounded-full border-2 border-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-blue-900 tracking-tighter leading-none uppercase">
                {site.name}
              </span>
              <span className="text-[10px] font-bold text-orange-600 tracking-[0.2em] uppercase">
                {site.university}
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center space-x-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                  isActive(link.href)
                    ? "bg-blue-900 text-white shadow-lg shadow-blue-900/20"
                    : "text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              href={signedIn ? "/dashboard" : "/login"}
              className="px-5 py-2 text-sm font-black text-blue-900 uppercase tracking-widest hover:text-orange-600 transition-colors"
            >
              {signedIn ? "Dashboard" : "Login"}
            </Link>
            <Link
              href="/register"
              className="bg-orange-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-[0.15em] hover:bg-blue-900 hover:shadow-xl transition-all flex items-center gap-2 group shadow-lg shadow-orange-600/20"
            >
              Join Us{" "}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <button
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="lg:hidden p-2 rounded-xl bg-slate-100 text-blue-900 hover:bg-blue-900 hover:text-white transition-all"
            onClick={() => setIsMenuOpen((v) => !v)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div
          className={`lg:hidden overflow-hidden transition-all duration-500 ease-in-out ${
            isMenuOpen ? "max-h-[500px] opacity-100 py-6" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`w-full text-left px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                  isActive(link.href) ? "bg-blue-900 text-white" : "bg-slate-50 text-slate-600"
                }`}
              >
                {link.name}
              </Link>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 mt-2">
              <Link
                href={signedIn ? "/dashboard" : "/login"}
                className="py-4 text-center font-black uppercase text-[10px] tracking-widest text-blue-900 bg-slate-100 rounded-2xl"
              >
                {signedIn ? "Dashboard" : "Login"}
              </Link>
              <Link
                href="/register"
                className="py-4 text-center font-black uppercase text-[10px] tracking-widest text-white bg-orange-600 rounded-2xl shadow-lg shadow-orange-600/20"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
