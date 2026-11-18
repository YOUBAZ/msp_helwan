"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Network,
  ShieldCheck,
  UserCircle,
  Users,
} from "lucide-react";
import Avatar from "@/components/dashboard/Avatar";
import { AuthProvider, useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/dashboard/inbox", label: "Inbox", Icon: MessageSquare, perm: "messages.view" },
  { href: "/dashboard/subscribers", label: "Subscribers", Icon: Mail, perm: "subscribers.view" },
  { href: "/dashboard/members", label: "Members", Icon: Users, perm: "members.view" },
  { href: "/dashboard/roles", label: "Roles", Icon: ShieldCheck },
  { href: "/dashboard/hierarchy", label: "Team Hierarchy", Icon: Network, perm: "seasons.manage" },
  { href: "/dashboard/profile", label: "My Profile", Icon: UserCircle },
];

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, can, logout } = useAuth();
  const items = NAV.filter((n) => !n.perm || can(n.perm));

  return (
    <section className="bg-slate-50 min-h-screen py-8 md:py-12">
      <div className="container mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        <aside className="lg:sticky lg:top-28 self-start min-w-0">
          <div className="bg-[#0f172a] rounded-[2rem] p-4 shadow-xl">
            <div className="px-3 py-4 border-b border-white/5 mb-3 flex items-center gap-3">
              <Avatar name={me.name} url={me.profile.avatarUrl} />
              <div className="min-w-0">
                <p className="text-white font-black truncate">{me.name}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-500 truncate">
                  {me.roles.map((r) => r.name).join(" · ") || "No role yet"}
                </p>
              </div>
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
              {items.map(({ href, label, Icon }) => {
                const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      active
                        ? "bg-orange-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon size={16} /> {label}
                  </Link>
                );
              })}
              <button
                onClick={logout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap text-slate-400 hover:text-white hover:bg-white/5 lg:mt-3 lg:border-t lg:border-white/5"
              >
                <LogOut size={16} /> Logout
              </button>
            </nav>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}

