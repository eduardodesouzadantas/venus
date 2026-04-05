"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, Share2, Download, RefreshCw, CheckCircle2, UserCircle2, Camera } from "lucide-react";
import { Heading } from "./Heading";
import { Text } from "./Text";
import { VenusButton } from "./VenusButton";
import { useUserImage } from "@/lib/onboarding/UserImageContext";
import { SimulatedCamera } from "./SimulatedCamera";

interface TryOnModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  name: string;
}

export function TryOnModal({ isOpen, onClose, imageUrl, name }: TryOnModalProps) {
  const { userPhoto, setUserPhoto } = useUserImage();
  const [status, setStatus] = useState<"idle" | "capturing" | "loading" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [showViralPrompt, setShowViralPrompt] = useState(false);
  const [currentCaption, setCurrentCaption] = useState("");

  const socialCaptions = [
    "O que acham desse estilo?",
    "Essa versão combina comigo?",
    "Atualizei meu estilo visual.",
    "Faz sentido para minha autoridade?",
    "Nova presença mapeada pelo Venus."
  ];

  useEffect(() => {
    if (isOpen) {
      if (!userPhoto) {
        setStatus("capturing");
      } else {
        startAIGeneration();
      }
      setCurrentCaption(socialCaptions[Math.floor(Math.random() * socialCaptions.length)]);
    } else {
      setStatus("idle");
    }
  }, [isOpen, userPhoto]);

  const startAIGeneration = () => {
    setStatus("loading");
    setProgress(0);
    setShowViralPrompt(false);
    
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setStatus("ready");
          return 100;
        }
        return prev + 2;
      });
    }, 40);
  };

  const handleCapture = (photo: string) => {
    setUserPhoto(photo);
    startAIGeneration();
  };

  if (!isOpen) return null;

  const handleShare = () => {
    setShowViralPrompt(true);
    if (navigator.share) {
       navigator.share({
         title: 'Venus Engine - My Style',
         text: currentCaption,
         url: window.location.href,
       }).catch(() => {});
    }
  };

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col bg-black transition-all duration-500 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-12 pb-6">
        <div className="flex flex-col">
           <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-bold tracking-[0.3em] text-[#D4AF37]">Hybrid AI Try-On</span>
              {userPhoto && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
           </div>
           <span className="text-white/60 text-[9px] uppercase tracking-widest leading-none">
              {status === "capturing" ? "Identificando Persona" : "Neural Style Transfer Active"}
           </span>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 overflow-hidden">
        {status === "capturing" ? (
          <div className="w-full max-w-sm mt-10">
             <SimulatedCamera onCapture={handleCapture} onCancel={onClose} />
          </div>
        ) : status === "loading" ? (
          <div className="w-full h-full flex flex-col items-center justify-center space-y-10">
            <div className="relative w-65 aspect-[3/4] rounded-[40px] overflow-hidden bg-white/5 border border-white/10 p-1">
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
               {/* SHOWING USER PHOTO AS BASE DURING GENERATION */}
               <img src={userPhoto || imageUrl} className="w-full h-full object-cover transition-all duration-1000 grayscale group-hover:grayscale-0" />
               
               <div className="absolute bottom-10 left-0 w-full flex flex-col items-center z-20 space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/20 flex items-center justify-center border border-[#D4AF37]/40 animate-pulse">
                     <Sparkles className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <Text className="text-[10px] uppercase tracking-[0.4em] text-[#D4AF37] font-bold">Aplicando seu estilo...</Text>
               </div>
               
               <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent shadow-[0_0_20px_rgba(212,175,55,1)] animate-scan-y z-30" />
            </div>

            <div className="w-full max-w-[280px] space-y-4">
               <div className="h-[2px] w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F1D57F] transition-all duration-300" style={{ width: `${progress}%` }} />
               </div>
               <div className="flex justify-between">
                  <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold">Mapeando Look: {name}</span>
                  <span className="text-[8px] text-[#D4AF37] font-mono">{progress}%</span>
               </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center overflow-y-auto no-scrollbar pb-20">
            {/* HYBRID AI Result */}
            <div className="relative w-full aspect-[4/5] rounded-[48px] overflow-hidden bg-[#0A0A0A] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.8)] mt-4 group">
               {/* THE "YOU" Result combines user image presence with product look */}
               <img src={imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
               <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
               
               {/* User Context Indication (Consistency) */}
               <div className="absolute top-8 left-8 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-[#D4AF37] p-0.5 overflow-hidden bg-black/40 backdrop-blur-md">
                     <img src={userPhoto || ""} className="w-full h-full object-cover rounded-full" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-white text-[10px] font-bold">Sua Versão AI</span>
                     <span className="text-[#D4AF37] text-[7px] uppercase tracking-widest font-bold leading-none">Consistent Persona</span>
                  </div>
               </div>

               <div className="absolute bottom-10 left-8 right-8">
                  <div className="text-[9px] text-[#D4AF37] uppercase tracking-[0.3em] font-bold mb-3 flex items-center gap-2">
                     <Sparkles size={12} /> Neural Transfer Complete
                  </div>
                  <Heading as="h3" className="text-2xl text-white tracking-tighter mb-4 leading-tight">{name}</Heading>
                  
                  <div className="p-4 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10">
                    <Text className="text-[11px] text-white/90 font-medium italic leading-relaxed">
                      &quot;{currentCaption}&quot;
                    </Text>
                  </div>
               </div>
            </div>

            {/* Part 7: Post Try-On Conversion Push */}
             <div className="w-full mt-12 p-8 rounded-[48px] bg-[#D4AF37]/5 border border-[#D4AF37]/20 space-y-8 animate-in zoom-in-95 duration-1000">
                <div className="space-y-2 text-center">
                   <Heading as="h4" className="text-xl tracking-tighter uppercase">Agora você já viu.</Heading>
                   <Text className="text-[10px] text-white/60 uppercase font-bold tracking-widest leading-relaxed">
                      Faz sentido continuar como está ou evoluir sua imagem agora?
                   </Text>
                </div>
                
                <div className="flex items-center justify-between px-4 py-6 rounded-3xl bg-black border border-white/5">
                   <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Investimento de Transfomação</span>
                      <span className="text-2xl font-serif text-[#D4AF37] tracking-widest">R$ 3.840,00</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[8px] text-green-500 font-bold uppercase tracking-widest">Bundle Efficient</span>
                      <span className="text-[10px] text-white/20 line-through">R$ 4.250</span>
                   </div>
                </div>

                <VenusButton variant="solid" className="w-full py-8 h-auto bg-white text-black text-[11px] font-bold uppercase tracking-[0.4em] rounded-full shadow-2xl active:scale-95 transition-all">
                   APLICAR ESTILO COMPLETO AGORA
                </VenusButton>
                
                <div className="flex items-center justify-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37]">Alta demanda: Vagas limitadas para essa curadoria</span>
                </div>
             </div>

             {/* Standard Actions (Secondary) or Viral Prompts */}
             <div className="w-full mt-10 grid grid-cols-2 gap-4">
                <VenusButton onClick={handleShare} variant="outline" className="py-6 h-auto text-[9px] font-bold uppercase tracking-[0.2em] border-white/5 text-white/40 flex-1 rounded-full group active:scale-95 transition-all">
                  <span className="flex items-center gap-2">
                    Compartilhar
                    <Share2 className="w-3 H-3 group-hover:scale-110 transition-transform" />
                  </span>
                </VenusButton>
                <VenusButton variant="outline" className="py-6 h-auto text-[9px] font-bold uppercase tracking-[0.2em] border-white/5 text-white/40 flex-1 rounded-full group active:scale-95 transition-all">
                  <span className="flex items-center gap-2">
                    Baixar Imagem
                    <Download className="w-3 H-3 group-hover:translate-y-0.5 transition-transform" />
                  </span>
                </VenusButton>
             </div>

             <div className="w-full mt-8 flex justify-between items-center px-4">
                <button onClick={() => setStatus("loading")} className="flex items-center gap-2 text-white/10 hover:text-white transition-colors group">
                   <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                   <span className="text-[8px] uppercase tracking-widest font-bold">Gerar Nova Versão</span>
                </button>
                <button onClick={() => setUserPhoto(null)} className="flex items-center gap-2 text-white/10 hover:text-white transition-colors">
                   <Camera className="w-3 h-3" />
                   <span className="text-[8px] uppercase tracking-widest font-bold">Refazer Foto</span>
                </button>
             </div>

            {/* Viral Prompt */}
            {showViralPrompt && (
               <div className="mt-12 flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  <div className="px-4 py-2 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center gap-2">
                     <CheckCircle2 className="w-4 H-4 text-[#D4AF37]" />
                     <span className="text-[10px] text-white/80 font-bold uppercase tracking-widest">Estilo Compartilhado</span>
                  </div>
                  <Text className="text-[11px] text-white/40 uppercase tracking-[0.3em] font-bold">Quer ver outra variação?</Text>
               </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-[60vh] bg-gradient-to-t from-[#D4AF37]/10 to-transparent pointer-events-none z-0" />
    </div>
  );
}
