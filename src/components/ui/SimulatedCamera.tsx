"use client";

import { Camera, Image as ImageIcon, Sparkles, X, Check } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";

interface SimulatedCameraProps {
  onCapture: (image: string) => void;
  onCancel: () => void;
}

export function SimulatedCamera({ onCapture, onCancel }: SimulatedCameraProps) {
  const handleUpload = () => {
    // Simple mock upload for now
    onCapture("https://i.pravatar.cc/600?u=current_user");
  };

  const handleSelfie = () => {
    // Simple mock selfie for now
    onCapture("https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format");
  };

  return (
    <div className="p-8 rounded-[48px] bg-black border border-white/10 space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex flex-col items-center text-center space-y-4">
         <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#D4AF37]">
            <Camera size={28} />
         </div>
         <div className="space-y-1">
            <Heading as="h4" className="text-xl tracking-tighter uppercase">Virtual Look Persona</Heading>
            <Text className="text-[10px] text-white/30 uppercase tracking-[0.4em] font-bold">Base para IA de Estilo</Text>
         </div>
      </div>

      <div className="space-y-4">
         <VenusButton onClick={handleSelfie} variant="solid" className="w-full py-7 h-auto bg-white text-black text-[11px] font-bold uppercase tracking-[0.3em] rounded-full group">
            <span className="flex items-center gap-2">
               Tirar Selfie Agora
               <Camera className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </span>
         </VenusButton>

         <VenusButton onClick={handleUpload} variant="outline" className="w-full py-7 h-auto border-white/10 text-white text-[11px] font-bold uppercase tracking-[0.3em] rounded-full group">
            <span className="flex items-center gap-2">
               Escolher da Galeria
               <ImageIcon className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
            </span>
         </VenusButton>
      </div>

      <div className="p-4 rounded-3xl bg-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-start gap-3">
         <Sparkles className="w-4 h-4 text-[#D4AF37] flex-shrink-0 mt-0.5" />
         <Text className="text-[10px] text-white/60 leading-relaxed italic">
            Sua foto será usada apenas pela IA para mapear o caimento ideal das peças no seu biotipo.
         </Text>
      </div>

      <button onClick={onCancel} className="w-full flex items-center justify-center p-4 text-white/20 hover:text-white transition-colors group">
         <X size={16} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>
    </div>
  );
}
