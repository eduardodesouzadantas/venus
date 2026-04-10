'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { VenusAvatar } from '@/components/venus/VenusAvatar';

function SplashContent() {
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
      {/* Halo Pulsante de Luxo - Agora como um anel fino */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[180px] h-[180px] rounded-full border border-[#D4AF37]/40 z-0"
      />

      {/* Logo V Dourado */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="mb-12 relative z-10"
      >
        <div className="relative">
             {/* Efeito de brilho muito sutil e contido */}
            <motion.div 
                animate={{ opacity: [0.1, 0.2, 0.1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-x-[-10px] inset-y-[-10px] bg-[#D4AF37]/10 rounded-full blur-md"
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

      {/* Background Decor removido para manter #0a0a0a puro */}
    </div>
  );
}

export default function SplashPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <SplashContent />
    </Suspense>
  );
}
