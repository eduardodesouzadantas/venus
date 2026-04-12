"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heading } from "@/components/ui/Heading";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";
import { CheckCircle2 } from "lucide-react";
import { updateB2CResult } from "@/lib/result/actions";

function SaveProfileForm() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!id) {
    return <div className="p-6 pt-20 text-white">URL inválida. Falta o identificador da leitura.</div>;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const formData = new FormData(e.currentTarget);
    const res = await updateB2CResult(formData, id);

    if (res?.error) {
      setErrorMsg(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 pt-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C9A84C]/10 blur-[100px]" />

      <GlassContainer className="relative z-10 w-full text-center shadow-2xl">
        <div className="mb-4 flex w-full justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#C9A84C] bg-[#C9A84C]/20 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <CheckCircle2 className="h-8 w-8 text-[#C9A84C]" />
          </div>
        </div>

        <Heading as="h3" className="mb-2">
          Salvar minha leitura
        </Heading>
        <Text className="mx-auto mb-8 max-w-sm text-xs text-white/50">
          Crie seu acesso rápido para recuperar o resultado depois. Não pedimos senha.
        </Text>

        {errorMsg && (
          <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-4 text-left">
          <div>
            <label className="ml-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Seu nome</label>
            <input
              name="name"
              required
              placeholder="Ex: Isabela"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white transition-colors placeholder:text-white/30 focus:border-[#C9A84C] focus:outline-none"
            />
          </div>

          <div>
            <label className="ml-2 text-[10px] font-bold uppercase tracking-wider text-white/40">E-mail de contato</label>
            <input
              name="email"
              type="email"
              required
              placeholder="voce@email.com"
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white transition-colors placeholder:text-white/30 focus:border-[#C9A84C] focus:outline-none"
            />
          </div>

          <VenusButton
            variant="solid"
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-[#C9A84C] text-black hover:bg-[#C9A84C]/80"
          >
            {loading ? "Salvando..." : "Salvar leitura"}
          </VenusButton>

          <Link href={`/result?id=${id}`} className="block w-full pt-2 text-center">
            <span className="pointer-events-auto text-xs text-white/40 underline underline-offset-4 hover:text-white">
              Voltar ao resultado
            </span>
          </Link>
        </form>
      </GlassContainer>
    </div>
  );
}

export default function SaveProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-white">Carregando...</div>}>
      <SaveProfileForm />
    </Suspense>
  );
}
