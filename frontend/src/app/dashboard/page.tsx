"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/dashboard/ui";
import { useAuth } from "@/lib/auth";

const SHORTCUTS = [
  { href: "/dashboard/inbox", label: "Read contact messages", perm: "messages.view" },
  { href: "/dashboard/members", label: "Invite and manage members", perm: "members.invite" },
  { href: "/dashboard/members", label: "View members", perm: "members.view" },
  { href: "/dashboard/roles", label: "Create and edit roles", perm: "roles.manage" },
  { href: "/dashboard/subscribers", label: "Newsletter subscribers", perm: "subscribers.view" },
  { href: "/dashboard/profile", label: "Update your name or password" },
];

export default function Overview() {
  const { me, can } = useAuth();
  const seen = new Set<string>();
  const shortcuts = SHORTCUTS.filter((s) => {
    if (s.perm && !can(s.perm)) return false;
    if (seen.has(s.href)) return false;
    seen.add(s.href);
    return true;
  });

  return (
    <>
      <PageTitle eyebrow="Squad Dashboard" title={`Hi, ${me.name.split(" ")[0]}`} />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            Your roles
          </h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {me.roles.length ? (
              me.roles.map((r) => (
                <Badge key={r.id} tone={r.name === "President" ? "orange" : "blue"}>
                  {r.name}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-slate-500">
                No role yet. Ask a board member to assign you one.
              </span>
            )}
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
            Permissions
          </h3>
          <p className="text-3xl font-black text-blue-900">
            {me.isPresident ? "All" : me.permissions.length}
          </p>
        </Card>
        <Card className="p-8">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
            Quick links
          </h3>
          <ul className="space-y-2">
            {shortcuts.map((s) => (
              <li key={s.label}>
                <Link
                  href={s.href}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 font-bold text-slate-700 hover:text-orange-600 group"
                >
                  {s.label}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
