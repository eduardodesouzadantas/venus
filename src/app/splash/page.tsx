'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { VenusAvatar } from '@/components/venus/VenusAvatar';
import { VenusLoadingScreen } from '@/components/ui/VenusLoadingScreen';

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
    const nextUrl = org ? `/onboarding/chat?org=${org}` : "/onboarding/chat";
    router.push(nextUrl);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-[#f0ece4] px-6 overflow-hidden relative">
      <style jsx global>{`
        @keyframes subtle-pulse {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50% { opacity: 0.22; transform: scale(1.15); }
        }
      `}</style>

      {/* Halo Pulsante de Luxo - Radial Glow */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none z-0"
        style={{
          background: "radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)",
          animation: "subtle-pulse 8s infinite ease-in-out"
        }}
      />

      {/* Logo V Dourado */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
        className="mb-14 relative z-10"
      >
        <div className="relative">
          {/* Efeito de brilho sutil */}
          <motion.div
            animate={{ opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-x-[-25px] inset-y-[-25px] bg-[#C9A84C]/10 rounded-full blur-2xl"
          />
          <VenusAvatar size={140} animated />
        </div>
      </motion.div>

      {/* Frase sequencial */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 max-w-sm text-center mb-20 relative z-10">
        {words.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 15, filter: "blur(8px)", scale: 0.9 }}
            animate={showText ? { opacity: 1, y: 0, filter: "blur(0px)", scale: 1 } : {}}
            transition={{
              duration: 1.2,
              delay: i * 0.45,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="font-serif text-3xl sm:text-4xl italic tracking-tight text-[#C9A84C]/90"
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
              transition={{ duration: 1, delay: 0.4 }}
              onClick={handleStart}
              className="inline-flex min-h-16 items-center justify-center rounded-full bg-[#C9A84C] px-12 py-5 text-[11px] font-bold uppercase tracking-[0.4em] text-[#0A0A0A] shadow-[0_20px_60px_rgba(201,168,76,0.2)] transition-all hover:scale-[1.03] active:scale-[0.98]"
            >
              Começar jornada →
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
    <Suspense fallback={<VenusLoadingScreen title="Abrindo a Venus" subtitle="Carregando a entrada premium da sua experiência." />}>
      <SplashContent />
    </Suspense>
  );
}
