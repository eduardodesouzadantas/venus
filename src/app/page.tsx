"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Partículas douradas flutuantes
function GoldParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${5 + Math.random() * 90}%`,
    top: `${5 + Math.random() * 90}%`,
    size: Math.random() > 0.5 ? 1 : 2,
    delay: `${Math.random() * 4}s`,
    duration: `${4 + Math.random() * 6}s`,
    opacity: 0.15 + Math.random() * 0.4,
  }));

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

// Linha de scan de IA
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fade in all elements gently
    timerRef.current = setTimeout(() => setRevealed(true), 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative flex flex-col h-[100dvh] bg-[#050505] overflow-hidden justify-between items-center" id="venus-splash">

      {/* ── BACKGROUND LAYER ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
        
        {/* Deep ambient glow at center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] rounded-full opacity-10"
             style={{ background: "radial-gradient(circle, #D4AF37 0%, transparent 60%)" }} />
      </div>

      <GoldParticles />
      <AIScanLine />

      {/* ── TOP: LOGO ── */}
      <div className={`relative z-10 w-full pt-16 pb-4 flex justify-center transition-all duration-1000 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-gold rounded-full" 
               style={{ background: "radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 60%)" }} />
          <span className="relative z-10 text-[2rem] font-bold"
                style={{ fontFamily: "var(--font-playfair), serif", color: "#D4AF37", textShadow: "0 0 15px rgba(212,175,55,0.6)" }}>
            V
          </span>
        </div>
      </div>

      {/* ── MIDDLE: IMAGE & COPY ── */}
      <div className="relative z-10 flex-1 w-full max-w-sm flex flex-col items-center justify-center -mt-6">
        
        {/* Image Container (blends into black) */}
        <div className={`relative w-full aspect-[4/5] max-w-[320px] transition-all duration-1000 delay-300 ${revealed ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          <img
            src="/hero-iconic.png"
            alt="Silhouette"
            className="w-full h-full object-cover object-center animate-breathe"
            style={{ 
              maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
              filter: "brightness(0.9) contrast(1.1) saturate(1.15)"
            }}
          />
          {/* Subtle gold border framing ONLY top and sides, fading out at bottom */}
          <div className="absolute inset-0 rounded-t-3xl pointer-events-none" style={{
            border: "1px solid rgba(212,175,55,0)",
            background: "linear-gradient(180deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(180deg, black 0%, black 1px, transparent 1px, transparent 100%), linear-gradient(90deg, black 0%, black 1px, transparent 1px, transparent 100%), linear-gradient(270deg, black 0%, black 1px, transparent 1px, transparent 100%)"
          }} />

          {/* AI Badge on corner */}
          <div className="absolute top-6 right-6">
            <div className="px-3 py-1.5 rounded-full border border-[#D4AF37]/30 bg-black/40 backdrop-blur-md shadow-[0_0_15px_rgba(212,175,55,0.2)]">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                <span className="text-[8px] tracking-[0.25em] text-[#D4AF37] font-bold uppercase">I.A. Ativa</span>
              </div>
            </div>
          </div>
        </div>

        {/* Copy Area (overlays the faded bottom of the image) */}
        <div className="relative text-center px-6 -mt-32">
          <h1 className={`transition-all duration-1000 delay-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ fontFamily: "var(--font-playfair), serif", fontSize: "clamp(2rem, 8vw, 2.5rem)", lineHeight: 1.15, color: "#fff" }}>
            Sua <span className="shimmer-text">Assinatura.</span><br />
            <span style={{ opacity: 0.9 }}>Revelada.</span>
          </h1>

          <div className={`mt-6 mb-5 mx-auto h-[1px] w-12 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-60 transition-all duration-1000 delay-700 ${revealed ? "w-16 opacity-60" : "w-0 opacity-0"}`} />

          <p className={`text-xs font-light leading-relaxed mx-auto max-w-[260px] opacity-60 transition-all duration-1000 delay-700 ${revealed ? "opacity-60 translate-y-0" : "opacity-0 translate-y-4"}`}
             style={{ color: "#ffffff" }}>
            Descubra a inteligência que redefine sua presença e eleva sua percepção no mundo.
          </p>
        </div>
      </div>

      {/* ── BOTTOM: CTA ── */}
      <div className={`relative z-10 w-full px-6 pb-12 transition-all duration-1000 delay-1000 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <Link href="/onboarding/intent" className="block w-full max-w-[280px] mx-auto">
          <button className="w-full relative overflow-hidden rounded-full py-3.5 text-xs font-semibold tracking-[0.15em] uppercase text-black transition-transform duration-300 active:scale-95 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] bg-gradient-to-r from-[#C5A02E] via-[#E8CAA4] to-[#C5A02E]"
                  style={{ backgroundSize: "200% auto", animation: "shimmer 4s linear infinite" }}>
            <span className="relative z-10">Iniciar Análise</span>
          </button>
        </Link>
      </div>

    </div>
  );
}
