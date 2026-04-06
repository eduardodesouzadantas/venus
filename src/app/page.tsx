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
      <header className={`relative z-20 flex flex-col items-center pt-12 transition-all duration-1000 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <span className="text-4xl font-bold tracking-[0.1em] text-[#D4AF37]"
              style={{ fontFamily: "var(--font-playfair), serif", textShadow: "0 0 20px rgba(212,175,55,0.4)" }}>
          V
        </span>
        <span className="text-[10px] tracking-[0.5em] font-light text-white/30 uppercase mt-2">
          Venus Engine
        </span>
      </header>

      {/* ── MAIN HERO SECTION ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-6">
        
        {/* Primary Hero Asset: Optimized for verticality */}
        <div className={`relative w-full aspect-[4/5] max-w-[260px] transition-all duration-1000 delay-200 ${revealed ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <div className="relative w-full h-full overflow-hidden rounded-[2.5rem] border border-white/[0.04] shadow-2xl">
            <img
              src="/hero-v2.png"
              alt="Luxury Silhouette"
              className="w-full h-full object-cover animate-breathe"
              style={{
                objectPosition: "50% 0%",
                transform: "scale(1)",
                maskImage: "linear-gradient(to bottom, black 88%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 88%, transparent 100%)",
                filter: "brightness(1) contrast(1.05)",
              }}
            />
            {/* Dark blending gradient to smooth the bottom transition */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent opacity-95" />
          </div>
        </div>

        {/* Messaging Area: High-impact typography */}
        <div className={`text-center mt-6 space-y-4 max-w-[320px] transition-all duration-1000 delay-400 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: "clamp(1.6rem, 5.5vw, 1.9rem)", lineHeight: 1.15, color: "#fff" }}>
            Sua <span className="shimmer-text">Assinatura.</span><br />
            <span style={{ opacity: 0.85 }}>Revelada.</span>
          </h1>

          <p className="text-[8px] font-light leading-relaxed text-white/30 max-w-[260px] mx-auto uppercase tracking-[0.25em]">
            Uma leitura visual que traduz presença em looks coerentes e prontos para uso real.
          </p>

          <div className="pt-6">
            <Link href="/onboarding/intent" className="block w-full max-w-[280px] mx-auto">
              <button className="w-full relative overflow-hidden rounded-full py-4 text-[10px] font-bold tracking-[0.25em] uppercase text-black transition-all duration-300 active:scale-95 shadow-[0_0_35px_rgba(212,175,55,0.35)] bg-gradient-to-r from-[#D4AF37] via-[#F0D060] to-[#D4AF37] bg-[length:200%_auto] hover:bg-right hover:shadow-[0_0_55px_rgba(212,175,55,0.55)] cursor-pointer">
                <span className="relative z-10">Começar leitura</span>
                {/* Interactive Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000 pointer-events-none" />
              </button>
            </Link>
          </div>
        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className={`relative z-20 px-6 pb-8 text-center transition-all duration-700 delay-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <p className="text-[7px] text-white/15 tracking-[0.6em] uppercase">
          © 2026 VENUS ENGINE · VISUAL INTELLIGENCE
        </p>
      </footer>

    </div>
  );
}
