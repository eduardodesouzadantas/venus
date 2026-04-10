"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types/hardened";

interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  orgId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, role: Role, orgSlug: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  lastError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        const appMeta = u.app_metadata as Record<string, string> | undefined;
        const userMeta = u.user_metadata as Record<string, string> | undefined;
        setUser({
          id: u.id,
          email: u.email ?? "",
          role: (appMeta?.role ?? userMeta?.role ?? "merchant_viewer") as Role,
          name: userMeta?.name ?? u.email?.split("@")[0] ?? "",
          orgId: appMeta?.org_id ?? userMeta?.org_id ?? undefined,
        });
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        const appMeta = u.app_metadata as Record<string, string> | undefined;
        const userMeta = u.user_metadata as Record<string, string> | undefined;
        setUser({
          id: u.id,
          email: u.email ?? "",
          role: (appMeta?.role ?? userMeta?.role ?? "merchant_viewer") as Role,
          name: userMeta?.name ?? u.email?.split("@")[0] ?? "",
          orgId: appMeta?.org_id ?? userMeta?.org_id ?? undefined,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, role: Role, orgSlug: string, password: string) => {
    setIsLoading(true);
    setLastError(null);

    try {
      if (role.startsWith("merchant_")) {
        if (!orgSlug) {
          throw new Error("Slug da loja é obrigatório para login de lojista");
        }

        const res = await fetch("/api/auth/merchant-provision", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ email, password, org_slug: orgSlug, role }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Falha ao provisionar lojista");
        }
      } else if (role.startsWith("agency_")) {
        const res = await fetch("/api/auth/agency-provision", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify({ email, password, role }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || "Falha ao provisionar acesso de agência");
        }
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      if (role.startsWith("agency_")) {
        router.push("/agency");
      } else {
        router.push("/merchant");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao entrar";
      setLastError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, lastError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
