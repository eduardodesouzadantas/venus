"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Gold floating particles (hydrated on client)
function GoldParticles() {
  const [particles, setParticles] = useState<{id: number, left: string, top: string, size: number, delay: string, duration: string, opacity: number}[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${5 + Math.random() * 90}%`,
        top: `${5 + Math.random() * 90}%`,
        size: Math.random() > 0.5 ? 1 : 2,
        delay: `${Math.random() * 4}s`,
        duration: `${4 + Math.random() * 6}s`,
        opacity: 0.15 + Math.random() * 0.4,
      }))
    );
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full animate-float"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            backgroundColor: "#D4AF37",
            opacity: p.opacity,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}

// AI Scan Line component
function AIScanLine() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      <div
        className="absolute left-0 right-0 h-px animate-scan"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.15) 20%, rgba(212,175,55,0.5) 50%, rgba(212,175,55,0.15) 80%, transparent 100%)",
        }}
      />
    </div>
  );
}

export default function SplashPage() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 150);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex flex-col h-[100dvh] bg-[#050505] overflow-hidden" id="venus-splash">

      {/* ── BACKGROUND LAYER: Depth & Grid ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#050505]" />
        
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[60vh] opacity-10"
             style={{ background: "radial-gradient(circle at 50% 0%, #D4AF37 0%, transparent 75%)" }} />

        {/* Global technical grid */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      <GoldParticles />
      <AIScanLine />

      {/* ── HEADER: BRAND IDENTITY ── */}
      <header className={`relative z-20 flex flex-col items-center pt-24 transition-all duration-1000 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <span className="text-4xl font-bold tracking-[0.1em] text-[#D4AF37]"
              style={{ fontFamily: "var(--font-playfair), serif", textShadow: "0 0 20px rgba(212,175,55,0.4)" }}>
          V
        </span>
        <span className="text-[10px] tracking-[0.5em] font-light text-white/30 uppercase mt-2">
          Venus Engine
        </span>
      </header>

      {/* ── MAIN HERO SECTION ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-10 px-6">
        
        {/* Primary Hero Asset: Cropped rigorously to remove baked-in asset UI */}
        <div className={`relative w-full aspect-[4/5] max-w-[320px] transition-all duration-1000 delay-300 ${revealed ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <div className="relative w-full h-full overflow-hidden rounded-[2.5rem] border border-white/[0.04] shadow-2xl">
            <img
              src="/hero-final.jpg"
              alt="Luxury Silhouette"
              className="w-full h-full object-cover animate-breathe"
              style={{ 
                // We zoom heavily (1.85x) to push any baked-in logos/text from the mockup asset out of the visible area.
                objectPosition: "50% 12%", 
                transform: "scale(1.85)", 
                maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                filter: "brightness(0.95) contrast(1.1)"
              }}
            />
            {/* Dark blending gradient to smooth the bottom transition */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-85" />
            
            {/* Real Code-Rendered Badge (Exclusive) */}
            <div className="absolute top-6 right-6">
              <div className="px-3 py-1.5 rounded-full border border-[#D4AF37]/30 bg-black/70 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span className="text-[8px] tracking-[0.2em] text-[#D4AF37] font-bold uppercase">I.A. Ativa</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Messaging Area */}
        <div className={`text-center mt-6 space-y-5 max-w-[320px] transition-all duration-1000 delay-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: "clamp(2.1rem, 9vw, 2.7rem)", lineHeight: 1.15, color: "#fff" }}>
            Sua <span className="shimmer-text">Assinatura.</span><br />
            <span style={{ opacity: 0.85 }}>Revelada.</span>
          </h1>

          <p className="text-xs font-light leading-relaxed text-white/50 max-w-[240px] mx-auto">
            A primeira inteligência que traduz sua presença em looks que comunicam sua melhor versão.
          </p>
        </div>
      </main>

      {/* ── FOOTER: PERSISTENT CTA ── */}
      <footer className={`relative z-20 px-6 pb-16 flex flex-col items-center transition-all duration-1000 delay-700 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <Link href="/onboarding/intent" className="block w-full max-w-[280px]">
          <button className="w-full relative overflow-hidden rounded-full py-4 text-[11px] font-bold tracking-[0.25em] uppercase text-black transition-all duration-300 active:scale-95 shadow-[0_0_25px_rgba(212,175,55,0.3)] bg-gradient-to-r from-[#D4AF37] via-[#F0D060] to-[#D4AF37] bg-[length:200%_auto] hover:bg-right hover:shadow-[0_0_45px_rgba(212,175,55,0.45)]">
            <span className="relative z-10">Iniciar Análise</span>
            {/* Interactive Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
          </button>
        </Link>
        <p className="text-center text-[9px] text-white/30 tracking-[0.4em] mt-8 uppercase">
          © 2026 VENUS ENGINE · PREMIUM AI EXPERIENCE
        </p>
      </footer>

    </div>
  );
}
