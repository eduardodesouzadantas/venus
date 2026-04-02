import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

export default function SplashPage() {
  return (
    <div className="flex flex-col h-screen items-center justify-center p-6 bg-gradient-to-t from-black to-[#121212]">
      <div className="flex-1 flex items-center justify-center">
        <Heading as="h1" className="text-5xl tracking-widest text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          VÊNUS.
        </Heading>
      </div>
      <div className="w-full pb-8 space-y-4 text-center z-10">
        <Text className="text-white/70">A essência do seu estilo codificada.</Text>
        <Link href="/onboarding/intent" className="block w-full">
          <VenusButton variant="solid" className="w-full">
            Descobrir Meu Estilo
          </VenusButton>
        </Link>
      </div>
    </div>
  );
}
