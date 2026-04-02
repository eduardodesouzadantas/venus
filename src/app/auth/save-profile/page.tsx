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
    return <div className="text-white p-6 pt-20">URL Inválida. Faltou a Chave Criptográfica.</div>
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
    <div className="flex flex-col min-h-screen p-6 pt-20 items-center justify-center bg-black">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#D4AF37]/10 blur-[100px] rounded-full pointer-events-none" />

      <GlassContainer className="w-full text-center relative z-10 shadow-2xl">
        <div className="flex justify-center w-full mb-4">
          <div className="w-16 h-16 bg-[#D4AF37]/20 border border-[#D4AF37] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)]">
             <CheckCircle2 className="w-8 h-8 text-[#D4AF37]" />
          </div>
        </div>
        
        <Heading as="h3" className="mb-2">Guardar Dossiê na Vênus</Heading>
        <Text className="text-xs text-white/50 mb-8 max-w-sm mx-auto">
          Crie seu passe livre informando seu nome. Não pedimos senha.
        </Text>

        {errorMsg && (
          <div className="p-3 mb-4 bg-red-500/10 text-red-500 text-xs rounded-md border border-red-500/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex flex-col text-left">
          
          <div>
            <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider ml-2">Seu Nome / Apelido</label>
            <input name="name" required placeholder="Ex: Isabela" className="w-full mt-1 p-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#D4AF37] transition-colors text-sm" />
          </div>

          <div>
            <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider ml-2">E-mail de Contato</label>
            <input name="email" type="email" required placeholder="voce@email.com" className="w-full mt-1 p-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#D4AF37] transition-colors text-sm" />
          </div>

          <VenusButton variant="solid" type="submit" disabled={loading} className="w-full mt-6 bg-[#D4AF37] hover:bg-[#D4AF37]/80 text-black">
            {loading ? "Codificando e Salvando..." : "Salvar Dossiê Definitivo"}
          </VenusButton>
          
          <Link href={`/result?id=${id}`} className="w-full block text-center pt-2">
            <span className="text-xs text-white/40 hover:text-white underline underline-offset-4 pointer-events-auto">Voltar para Resultados (Descartar)</span>
          </Link>
        </form>
      </GlassContainer>
    </div>
  );
}

export default function SaveProfilePage() {
  return (
    <Suspense fallback={<div className="p-6 text-white text-center">Carregando...</div>}>
      <SaveProfileForm />
    </Suspense>
  );
}
