import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-white/[0.04] px-8 py-10 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10">
          <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-sm font-medium tracking-[0.08em] text-[#D4AF37] uppercase">Agency</div>
          <div className="text-lg tracking-tight">Carregando painel da agência</div>
          <div className="text-sm text-white/45">A base está sendo resolvida com segurança.</div>
        </div>
      </div>
    </div>
  );
}
