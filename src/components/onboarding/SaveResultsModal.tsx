"use client";

import React, { useState } from "react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { ShieldCheck, Phone, Mail, User, X, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/lib/onboarding/OnboardingContext";
import { triggerReEngagement } from "@/lib/whatsapp/AutomationEngine";

interface SaveResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToLooks?: () => void;
  stats: any;
}

export const SaveResultsModal = ({ isOpen, onClose, onGoToLooks, stats }: SaveResultsModalProps) => {
  const { data, updateData } = useOnboarding();
  const [formData, setFormData] = useState({
    name: data.contact?.name || "",
    phone: data.contact?.phone || "",
    email: data.contact?.email || "",
  });
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    updateData("contact", formData);
    setIsSaved(true);

    setTimeout(() => {
      triggerReEngagement(
        { name: formData.name, phone: formData.phone, context: stats as any },
        "high_intent_exit"
      );
    }, 5000);
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
            className="relative w-full max-w-lg overflow-hidden rounded-[40px] border border-white/10 bg-white/[0.03] shadow-[0_0_80px_rgba(212,175,55,0.1)]"
          >
            <div className="space-y-2 border-b border-white/5 bg-black/40 p-10 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#D4AF37]">
                <ShieldCheck size={24} />
              </div>
              <Heading as="h2" className="text-xl tracking-tight uppercase">
                Salvar minha leitura
              </Heading>
              <Text className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">
                Protocolo de leitura Venus
              </Text>
            </div>

            <div className="p-10">
              {!isSaved ? (
                <form onSubmit={handleSave} className="space-y-6">
                  <p className="px-4 text-center font-serif text-xs italic leading-relaxed text-white/60">
                    "Salve sua leitura para recuperar depois e receber novas sugestões de estilo por WhatsApp."
                  </p>

                  <div className="space-y-4">
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 transition-all group-focus-within:text-[#D4AF37]" />
                      <input
                        required
                        type="text"
                        placeholder="Seu nome"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-14 w-full rounded-2xl border border-white/5 bg-white/5 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-white/20 focus:border-[#D4AF37]/40"
                      />
                    </div>

                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 transition-all group-focus-within:text-[#D4AF37]" />
                      <input
                        required
                        type="tel"
                        placeholder="WhatsApp"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="h-14 w-full rounded-2xl border border-white/5 bg-white/5 pl-12 pr-4 text-sm font-mono outline-none transition-all placeholder:text-white/20 focus:border-[#D4AF37]/40"
                      />
                    </div>

                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 transition-all group-focus-within:text-[#D4AF37]" />
                      <input
                        required
                        type="email"
                        placeholder="Seu e-mail"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="h-14 w-full rounded-2xl border border-white/5 bg-white/5 pl-12 pr-4 text-sm outline-none transition-all placeholder:text-white/20 focus:border-[#D4AF37]/40"
                      />
                    </div>
                  </div>

                  <VenusButton
                    type="submit"
                    className="h-auto w-full bg-[#D4AF37] px-6 py-8 text-xs font-bold uppercase tracking-[0.4em] text-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Salvar e continuar
                  </VenusButton>

                  <div className="flex items-center justify-center gap-2 pt-2 opacity-40 grayscale">
                    <ShieldCheck size={12} className="text-[#D4AF37]" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Proteção de dados • Consentimento explícito</span>
                  </div>
                </form>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 py-4 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                    <CheckCircle2 size={40} />
                  </div>
                  <div className="space-y-2">
                    <Heading as="h3" className="text-xl uppercase tracking-tighter">
                      Leitura salva
                    </Heading>
                    <Text className="text-xs leading-relaxed uppercase tracking-widest text-white/40">
                      Sua assinatura ficou vinculada ao Venus Engine. <br />
                      Em instantes, sua curadoria pode entrar em contato.
                    </Text>
                  </div>
                  <div className="flex flex-col gap-3">
                    <VenusButton
                      type="button"
                      onClick={() => {
                        onGoToLooks?.();
                      }}
                      className="h-auto w-full bg-white px-6 py-6 text-[10px] font-bold uppercase tracking-[0.4em] text-black"
                    >
                      Ver meus looks
                    </VenusButton>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex items-center justify-center gap-2 text-[8px] font-bold uppercase tracking-[0.4em] text-white/30 transition-all hover:text-[#D4AF37]"
                    >
                      Fechar
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <button onClick={onClose} className="absolute right-6 top-6 rounded-full p-2 text-white/10 transition-all hover:bg-white/5 hover:text-white">
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
