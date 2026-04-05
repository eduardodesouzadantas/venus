import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { VenusButton } from "@/components/ui/VenusButton";
import { createProduct } from "./actions";

function formatErrorMessage(error?: string) {
  if (!error) return null;

  if (error.startsWith("tenant_blocked:")) {
    const reason = error.split(":")[1] || "";
    if (reason === "kill_switch_on") {
      return "Org com kill switch ativo. Operação bloqueada.";
    }
    if (reason === "suspended") {
      return "Org suspensa. Operação bloqueada.";
    }
    if (reason === "blocked") {
      return "Org bloqueada. Operação bloqueada.";
    }
    return "Tenant sem permissão operacional no momento.";
  }

  if (error.startsWith("hard_cap:")) {
    const metric = error.split(":")[1] || "";
    if (metric === "products") {
      return "Limite server-side do plano atingido para produtos.";
    }
    return "Limite server-side do plano atingido.";
  }

  return error;
}

export default function ProductNewPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = formatErrorMessage(searchParams?.error);

  return (
    <div className="flex flex-col min-h-screen p-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <Heading as="h2" className="text-[#D4AF37]">Novo Cadastro</Heading>
        <Link href="/merchant"><VenusButton variant="ghost" className="px-0 py-0 h-auto">Voltar</VenusButton></Link>
      </div>
      
      <GlassContainer>
        {errorMessage && (
          <div className="p-3 mb-4 bg-red-500/10 text-red-500 text-xs rounded-md border border-red-500/20">
            {errorMessage}
          </div>
        )}
        
        <form action={createProduct} className="space-y-4 flex flex-col font-sans">
          <div>
            <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">Nome da Peça</label>
            <input name="name" required placeholder="Ex: Blazer de Linho Cru" className="w-full mt-1 p-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">Categoria</label>
              <input name="category" required placeholder="Ex: Casacos" className="w-full mt-1 p-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">Tipo</label>
              <select name="type" required className="w-full mt-1 p-3 rounded-xl bg-[#1A1A1A] border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm">
                <option value="roupa">Roupa (Vestuário)</option>
                <option value="acessorio">Acessório</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">Cor Dominante</label>
              <input name="primary_color" placeholder="Ex: Bege" className="w-full mt-1 p-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">Estilo Padrão</label>
              <select name="style" className="w-full mt-1 p-3 rounded-xl bg-[#1A1A1A] border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm">
                <option value="Alfaiataria">Alfaiataria</option>
                <option value="Casual">Casual</option>
                <option value="Street">Streetwear</option>
                <option value="Festa">Festa / Luxo</option>
              </select>
            </div>
          </div>

          <div>
             <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">URL da Foto Ateliê / Loja</label>
             <input name="image_url" placeholder="https://" className="w-full mt-1 p-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm" />
          </div>

          <div>
             <label className="text-xs text-white/50 pl-1 uppercase font-bold tracking-wider">URL de Destino (Link de Venda)</label>
             <input name="external_url" type="url" placeholder="https://" className="w-full mt-1 p-3 rounded-xl bg-black/40 border border-white/10 text-white focus:border-[#D4AF37] focus:outline-none text-sm" />
          </div>

          <VenusButton variant="solid" type="submit" className="w-full mt-6 bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black shadow-[0_0_15px_rgba(212,175,55,0.2)]">
            Salvar Inventário
          </VenusButton>
        </form>
      </GlassContainer>
    </div>
  );
}
