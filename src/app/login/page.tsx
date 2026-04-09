"use client";

import { useState } from "react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { ShieldCheck, Briefcase, Lock, Mail, Eye, EyeOff, ArrowRight, Store } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Role } from "@/types/hardened";

export default function LoginPage() {
  const [role, setRole] = useState<"agency" | "merchant">("merchant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, lastError } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const targetRole: Role = role === "merchant" ? "merchant_owner" : "agency_owner";
      const targetOrg = role === "merchant" ? orgSlug : "";

      if (role === "merchant" && !targetOrg.trim()) {
        throw new Error("Informe o slug da sua loja");
      }

      await login(email, targetRole, targetOrg, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/[0.05] via-transparent to-transparent overflow-hidden">
      <div className="w-full max-w-sm space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37] flex items-center justify-center text-black font-serif text-2xl font-bold shadow-[0_0_40px_rgba(212,175,55,0.4)]">
            V
          </div>
          <div className="space-y-1">
            <Text className="text-[10px] uppercase font-bold tracking-[0.6em] text-[#D4AF37]">Venus Engine</Text>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase leading-none">Acesso Restrito</Heading>
          </div>
        </div>

        <div className="p-1.5 rounded-full bg-white/5 border border-white/10 flex">
          <button
            onClick={() => setRole("merchant")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              role === "merchant" ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"
            }`}
          >
            <Briefcase size={14} /> Lojista
          </button>
          <button
            onClick={() => setRole("agency")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              role === "agency"
                ? "bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                : "text-white/40 hover:text-white"
            }`}
          >
            <ShieldCheck size={14} /> Agency Master
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {(error || lastError) && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error || lastError}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#D4AF37] transition-colors" />
              <input
                type="email"
                placeholder="Email corporativo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl pl-12 pr-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all"
                required
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#D4AF37] transition-colors" />
              <input
                type={showPass ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl pl-12 pr-12 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {role === "merchant" && (
              <div className="relative group">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#D4AF37] transition-colors" />
                <input
                  type="text"
                  placeholder="Slug da loja (ex: minha-loja)"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl pl-12 pr-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all"
                  required
                />
              </div>
            )}
          </div>

          <VenusButton
            type="submit"
            disabled={isLoading}
            variant="solid"
            className={`w-full py-8 h-auto text-[11px] font-bold uppercase tracking-[0.4em] rounded-full shadow-2xl active:scale-[0.98] transition-all ${
              role === "agency" ? "bg-[#D4AF37] text-black" : "bg-white text-black"
            }`}
          >
            {isLoading ? "Validando Acesso..." : role === "merchant" ? "ENTRAR NO PAINEL" : "ENTRAR NA AGÊNCIA"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </VenusButton>

          <button
            type="button"
            className="w-full text-[10px] text-white/20 uppercase font-bold tracking-widest hover:text-white transition-colors"
          >
            Esqueci minha senha
          </button>
        </form>

        <div className="flex flex-col items-center pt-10 border-t border-white/5">
          <Text className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-4">Integridade Multi-Tenant Ativa</Text>
          <div className="flex gap-4">
            <ShieldCheck className="w-4 h-4 text-[#D4AF37]" aria-label="Secure Session" />
            <Lock className="w-4 h-4 text-green-500" aria-label="Isolated Scope" />
          </div>
        </div>
      </div>
    </div>
  );
}
