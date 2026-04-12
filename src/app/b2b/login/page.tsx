import { Heading } from "@/components/ui/Heading";
import { GlassContainer } from "@/components/ui/GlassContainer";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";
import { login } from "./actions";

export default function B2BLoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="flex flex-col min-h-screen p-6 items-center justify-center bg-black">
      <GlassContainer className="w-full max-w-sm">
        <Heading as="h3" className="mb-2 text-[#C9A84C]">Venus B2B Platform</Heading>
        <Text className="text-sm text-white/50 mb-6">Acesso restrito para lojistas e marcas.</Text>
        
        {searchParams?.error && (
          <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-md">
            {searchParams.error}
          </div>
        )}

        <form action={login} className="space-y-4 flex flex-col">
          <input
            id="email"
            name="email"
            type="email"
            placeholder="E-mail gerencial"
            required
            className="w-full p-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#C9A84C] transition-colors font-sans text-sm"
          />
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Sua senha"
            required
            className="w-full p-4 rounded-xl border border-white/10 bg-white/5 text-white focus:outline-none focus:border-[#C9A84C] transition-colors font-sans text-sm"
          />
          
          <VenusButton variant="solid" type="submit" className="w-full mt-4">
            Entrar no Painel
          </VenusButton>
        </form>
      </GlassContainer>
    </div>
  );
}
