"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@/types/hardened";

interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  orgId?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, role: Role, orgId?: string, password?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("venus_session");
    if (saved) {
      setUser(JSON.parse(saved));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, role: Role, orgId?: string, password?: string) => {
    setIsLoading(true);
    try {
      // Mock login delay
      await new Promise(resolve => setTimeout(resolve, 800));

      let canonicalUserId = `u_${Math.random().toString(36).substring(7)}`;

      if (role.startsWith("merchant_")) {
        const merchantOrg = orgId || "maison-elite";
        const merchantPassword = password || "venus-demo-password";

        const provisionResponse = await fetch("/api/auth/merchant-provision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({
            email,
            password: merchantPassword,
            org_slug: merchantOrg,
            org_id: merchantOrg,
            role,
          }),
        });

        if (!provisionResponse.ok) {
          throw new Error("Unable to provision merchant auth");
        }

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: merchantPassword,
        });

        if (signInError) {
          throw signInError;
        }

        const { data: currentUserData } = await supabase.auth.getUser();
        canonicalUserId = currentUserData.user?.id || canonicalUserId;
      } else if (role.startsWith("agency_")) {
        const agencyPassword = password || "venus-demo-password";

        const provisionResponse = await fetch("/api/auth/agency-provision", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          },
          body: JSON.stringify({
            email,
            password: agencyPassword,
            role,
          }),
        });

        if (!provisionResponse.ok) {
          throw new Error("Unable to provision agency auth");
        }

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: agencyPassword,
        });

        if (signInError) {
          throw signInError;
        }

        const { data: currentUserData } = await supabase.auth.getUser();
        canonicalUserId = currentUserData.user?.id || canonicalUserId;
      }

      const newUser: User = {
        id: canonicalUserId,
        email,
        name: email.split('@')[0],
        role,
        ...(orgId ? { orgId } : {}),
      };

      setUser(newUser);
      localStorage.setItem("venus_session", JSON.stringify(newUser));

      if (role.startsWith('agency')) {
        router.push("/agency");
      } else {
        router.push("/merchant");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("venus_session");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
