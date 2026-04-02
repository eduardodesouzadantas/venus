import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { getB2BProducts } from "@/lib/catalog";
import { signout } from "../login/actions";
import { PackageOpen, LogOut, Plus } from "lucide-react";

export default async function B2BDashboardPage({ searchParams }: { searchParams: { created?: string } }) {
  const products = await getB2BProducts();

  return (
    <div className="flex flex-col min-h-screen p-6 bg-black">
      {searchParams?.created === "true" && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold py-3 px-4 rounded-xl mb-4 text-center">
          Novo Produto Cadastrado com Sucesso na Vênus!
        </div>
      )}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <Heading as="h1" className="text-2xl lg:text-2xl text-[#D4AF37]">Terminal B2B</Heading>
        <form action={signout}>
          <button type="submit" className="text-white/40 hover:text-white p-2">
            <LogOut className="w-5 h-5" />
          </button>
        </form>
      </div>
      
      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/10 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
             <PackageOpen className="w-8 h-8 text-white/50" />
          </div>
          <Heading as="h4" className="mb-2">Seu catálogo está vazio</Heading>
          <Text className="text-sm text-white/50 mb-8 max-w-[250px]">
            Adicione sua primeira peça para que a IA comece a recomendá-la aos clientes da plataforma.
          </Text>
          <Link href="/b2b/product/new">
            <VenusButton variant="glass" className="border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 flex gap-2">
              <Plus className="w-4 h-4"/> Adicionar Primeiro SKU
            </VenusButton>
          </Link>
        </div>
      ) : (
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <Text className="text-sm text-white/60 font-semibold">{products.length} itens ativos</Text>
            <Link href="/b2b/product/new">
              <div className="text-xs bg-white text-black px-4 py-2 rounded-full font-bold flex items-center gap-1 hover:scale-95 transition-transform cursor-pointer">
                <Plus className="w-3 h-3"/> Novo
              </div>
            </Link>
          </div>

          <div className="space-y-3 pb-10">
            {products.map(p => (
               <div key={p.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                 <div className="w-16 h-16 bg-[#1A1A1A] rounded-xl overflow-hidden shadow-inner border border-white/5 flex items-center justify-center">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <PackageOpen className="w-5 h-5 text-white/20" />
                    )}
                 </div>
                 <div className="flex-1">
                    <p className="font-bold text-sm text-white/90 line-clamp-1">{p.name}</p>
                    <p className="text-xs text-white/50 font-mono tracking-wide uppercase mt-1">{p.category} • {p.style}</p>
                 </div>
                 <div className="text-xs border border-white/10 px-2 py-1 rounded-md text-white/40">
                    {p.type === 'roupa' ? '👗' : '💍'}
                 </div>
               </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
