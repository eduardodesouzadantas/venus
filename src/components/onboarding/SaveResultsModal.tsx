"use client";

import React, { useState } from "react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { ShieldCheck, Phone, Mail, User, X, CheckCircle2, ChevronRight, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { triggerReEngagement } from "@/lib/whatsapp/AutomationEngine";

interface SaveResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: any;
}

export const SaveResultsModal = ({ isOpen, onClose, stats }: SaveResultsModalProps) => {
  const { data, updateData } = useOnboarding();
  const [formData, setFormData] = useState({
    name: data.contact?.name || "",
    phone: data.contact?.phone || "",
    email: data.contact?.email || ""
  });
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    updateData("contact", formData);
    
    // Simulate Supabase Save & Automation Trigger
    setIsSaved(true);
    
    // Trigger First re-engagement after 1 minute automatically as "Welcome" / "Proof of Concept"
    setTimeout(() => {
        triggerReEngagement(
          { name: formData.name, phone: formData.phone, context: stats as any },
          'high_intent_exit'
        );
    }, 5000); // 5 seconds for demo purposes
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-lg bg-white/[0.03] border border-white/10 rounded-[48px] overflow-hidden relative shadow-[0_0_80px_rgba(212,175,55,0.1)]"
          >
             {/* Header */}
             <div className="p-10 border-b border-white/5 space-y-2 text-center bg-black/40">
                <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] mx-auto mb-4 border border-[#D4AF37]/20">
                   <ShieldCheck size={24} />
                </div>
                <Heading as="h2" className="text-xl tracking-tight uppercase">Sincronizar Acervo</Heading>
                <Text className="text-[10px] text-white/40 uppercase tracking-[0.4em] font-bold">Protocolo de Identidade Venus</Text>
             </div>

             <div className="p-10">
                {!isSaved ? (
                   <form onSubmit={handleSave} className="space-y-6">
                      <p className="text-xs text-white/60 text-center leading-relaxed font-serif italic italic px-4">
                         "Sua curadoria é viva. Salve sua assinatura de estilo e receba atualizações exclusivas da Maison diretamente via Curadoria AI (WhatsApp)."
                      </p>
                      
                      <div className="space-y-4">
                        <div className="relative group">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#D4AF37] transition-all" />
                          <input 
                            required
                            type="text" 
                            placeholder="Nome Completo" 
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                            className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37]/40 transition-all placeholder:text-white/20"
                          />
                        </div>

                        <div className="relative group">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#D4AF37] transition-all" />
                          <input 
                            required
                            type="tel" 
                            placeholder="WhatsApp (ex: +55 11 99999-9999)" 
                            value={formData.phone}
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                            className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37]/40 transition-all placeholder:text-white/20 font-mono"
                          />
                        </div>

                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-[#D4AF37] transition-all" />
                          <input 
                            required
                            type="email" 
                            placeholder="E-mail Executivo" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 text-sm outline-none focus:border-[#D4AF37]/40 transition-all placeholder:text-white/20"
                          />
                        </div>
                      </div>

                      <VenusButton type="submit" className="w-full py-8 h-auto text-xs font-bold uppercase tracking-[0.4em] bg-[#D4AF37] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_20px_40px_rgba(212,175,55,0.2)]">
                         Sincronizar Agora
                      </VenusButton>

                      <div className="flex items-center justify-center gap-2 pt-2 grayscale opacity-40">
                         <ShieldCheck size={12} className="text-[#D4AF37]" />
                         <span className="text-[8px] uppercase tracking-widest font-bold">Cortex 256-bit Encryption • GDPR Compliant</span>
                      </div>
                   </form>
                ) : (
                   <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="text-center space-y-8 py-4"
                   >
                      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mx-auto">
                         <CheckCircle2 size={40} />
                      </div>
                      <div className="space-y-2">
                         <Heading as="h3" className="text-xl uppercase tracking-tighter">Identidade Salva</Heading>
                         <Text className="text-xs text-white/40 leading-relaxed uppercase tracking-widest">
                            Sua curadoria foi vinculada ao Venus Engine. <br />
                            Em instantes, sua IA de estilo entrará em contato.
                         </Text>
                      </div>
                      <div className="flex flex-col gap-3">
                        <VenusButton onClick={onClose} className="w-full py-6 h-auto text-[10px] font-bold uppercase tracking-[0.4em] bg-white text-black">
                           Retornar ao Dashboard
                        </VenusButton>
                        <button className="flex items-center justify-center gap-2 text-[8px] uppercase tracking-[0.4em] text-white/30 font-bold hover:text-[#D4AF37] transition-all">
                           <Share2 size={12} /> Compartilhar Visagismo
                        </button>
                      </div>
                   </motion.div>
                )}
             </div>

             <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-white/10 hover:text-white transition-all transition-all">
                <X size={20} />
             </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
