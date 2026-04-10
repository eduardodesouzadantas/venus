'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { VenusAvatar } from '@/components/venus/VenusAvatar';

export default function SplashPage() {
  const router = useRouter();
  const [showText, setShowText] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Logo fade in is 1.5s, so we show text after that
    const textTimer = setTimeout(() => setShowText(true), 1500);
    // Button appears after 3s total
    const buttonTimer = setTimeout(() => setShowButton(true), 3000);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(buttonTimer);
    };
  }, []);

  const words = ["A", "Venus", "entende", "sua", "essência."];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white px-6 overflow-hidden">
      {/* Logo V Dourado */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="mb-12"
      >
        <VenusAvatar size={120} animated />
      </motion.div>

      {/* Frase linha por linha / palavra por palavra */}
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 max-w-xs text-center mb-16">
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
      <AnimatePresence>
        {showButton && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            onClick={() => router.push('/onboarding/intent')}
            className="inline-flex min-h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#F1D77A_0%,#D4AF37_100%)] px-10 py-4 text-[13px] font-bold uppercase tracking-[0.3em] text-[#0A0A0A] shadow-[0_20px_50px_rgba(212,175,55,0.25)] transition-transform active:scale-[0.98]"
          >
            COMEÇAR LEITURA →
          </motion.button>
        )}
      </AnimatePresence>

      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}
