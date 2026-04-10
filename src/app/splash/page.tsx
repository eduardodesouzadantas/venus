'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { VenusAvatar } from '@/components/venus/VenusAvatar';

export default function SplashPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const org = searchParams.get('org');
  const [showText, setShowText] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Logo fade in is 1.5s
    const textTimer = setTimeout(() => setShowText(true), 1500);
    // Button appears after 3s total
    const buttonTimer = setTimeout(() => setShowButton(true), 3000);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  const words = ["A", "Venus", "entende", "sua", "essência."];

  const handleStart = () => {
    const nextUrl = org ? `/onboarding/intent?org=${org}` : '/onboarding/intent';
    router.push(nextUrl);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white px-6 overflow-hidden relative">
      {/* Halo Pulsante de Luxo */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[300px] h-[300px] rounded-full border border-[#D4AF37]/20 blur-2xl"
      />

      {/* Logo V Dourado */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="mb-12 relative z-10"
      >
        <div className="relative">
             {/* Efeito de brilho pulsar ao redor */}
            <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-[#D4AF37]/20 rounded-full blur-xl"
            />
            <VenusAvatar size={120} animated />
        </div>
      </motion.div>

      {/* Frase sequencial */}
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 max-w-xs text-center mb-16 relative z-10">
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={showText ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.8,
              delay: i * 0.3,
              ease: "easeOut"
            }}
            className="font-serif text-2xl sm:text-3xl italic tracking-wide text-[#D4AF37]"
          >
            {word}
          </motion.span>
        ))}
      </div>

      {/* Botão Único */}
      <div className="h-16 relative z-10">
        <AnimatePresence>
          {showButton && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              onClick={handleStart}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#F1D77A_0%,#D4AF37_100%)] px-10 py-4 text-[13px] font-bold uppercase tracking-[0.3em] text-[#0A0A0A] shadow-[0_20px_50px_rgba(212,175,55,0.25)] transition-transform active:scale-[0.98]"
            >
              Descobrir meu estilo →
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#D4AF37]/5 rounded-full blur-[140px]" />
      </div>
    </div>
  );
}
