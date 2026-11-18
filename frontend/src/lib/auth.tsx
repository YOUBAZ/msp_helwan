"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY } from "./api";
import type { Me, Role } from "./types";

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

type AuthState = {
  me: Me;
  token: string;
  /** True if the signed-in user has this permission. */
  can: (permission: string) => boolean;
  /** True if the user may hand this role to someone (no privilege escalation). */
  canGrant: (role: Pick<Role, "isSystem" | "permissions">) => boolean;
  /** Authenticated API call. */
  call: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  refresh: () => Promise<void>;
  setToken: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setTokenState] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const logout = useCallback(() => {
    saveToken(null);
    router.replace("/login");
  }, [router]);

  const load = useCallback(
    async (t: string) => {
      try {
        setMe(await api<Me>("/auth/me", { token: t }));
      } catch {
        logout();
      }
    },
    [logout],
  );

  useEffect(() => {
    const t = readToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setTokenState(t);
    void load(t);
  }, [load, router]);

  const call = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      try {
        return await api<T>(path, { ...init, token });
      } catch (err) {
        if ((err as Error).message.startsWith("Session expired")) logout();
        throw err;
      }
    },
    [token, logout],
  );

  const value = useMemo<AuthState | null>(() => {
    if (!token || !me) return null;
    const can = (p: string) => me.isPresident || me.permissions.includes(p);
    return {
      me,
      token,
      can,
      canGrant: (role) =>
        role.isSystem ? me.isPresident : role.permissions.every((p) => can(p)),
      call,
      refresh: () => load(token),
      setToken: (t) => {
        saveToken(t);
        setTokenState(t);
        void load(t);
      },
      logout,
    };
  }, [me, token, call, load, logout]);

  if (!value) {
    return (
      <section className="py-24 min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Loading…</p>
      </section>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
