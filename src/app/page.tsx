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
    timerRef.current = setTimeout(() => setRevealed(true), 120);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative flex flex-col h-screen bg-black overflow-hidden" id="venus-splash">

      {/* ── FUNDO: gradiente editorial em camadas ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Canvas escuro base */}
        <div className="absolute inset-0 bg-[#050505]" />

        {/* Luz dourada lateral sutil */}
        <div
          className="absolute -top-1/4 -right-1/4 w-[80vw] h-[80vw] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #D4AF37 0%, transparent 70%)" }}
        />

        {/* Luz violeta quente no canto inferior */}
        <div
          className="absolute -bottom-1/3 -left-1/3 w-[90vw] h-[90vw] rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #7C3AED 0%, transparent 65%)" }}
        />

        {/* Vinheta bordas */}
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.85) 100%)"
        }} />

        {/* Grade tecnológica sutil */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(rgba(212,175,55,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* Partículas flutuantes */}
      <GoldParticles />

      {/* Linha de scan de IA */}
      <AIScanLine />

      {/* ── HEADER: Logo marca ── */}
      <div className={`relative z-10 flex items-center justify-center pt-14 pb-0 transition-all duration-700 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}>
        <div className="flex flex-col items-center gap-2">
          {/* Monograma V */}
          <div className="relative w-14 h-14 flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full animate-pulse-gold"
              style={{ background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)" }}
            />
            <span
              className="text-3xl font-bold tracking-[0.05em]"
              style={{
                fontFamily: "var(--font-playfair), serif",
                color: "#D4AF37",
                textShadow: "0 0 20px rgba(212,175,55,0.7)",
              }}
            >
              V
            </span>
          </div>
          <span className="text-[9px] tracking-[0.35em] font-light text-white/30 uppercase">
            Venus Engine
          </span>
        </div>
      </div>

      {/* ── HERO CENTRAL: Imagem editorial + copy ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 -mt-8">

        {/* Imagem hero editorial */}
        <div className={`relative w-full max-w-[280px] mx-auto mb-8 transition-all duration-1000 delay-200 ${revealed ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
          {/* Frame dourado */}
          <div className="absolute -inset-[1px] rounded-2xl" style={{
            background: "linear-gradient(135deg, rgba(212,175,55,0.5) 0%, transparent 50%, rgba(212,175,55,0.3) 100%)"
          }} />

          {/* Imagem com overlay */}
          <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
            <img
              src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&q=90&w=600&h=800"
              alt="Venus Engine editorial"
              className="w-full h-full object-cover object-top"
              style={{ filter: "brightness(0.55) contrast(1.1) saturate(0.7)" }}
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&q=90&w=600&h=800";
              }}
            />
            {/* Overlay dourado escuro */}
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.1) 100%)"
            }} />
            {/* Linha dourada decorativa */}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 animate-line-grow h-px bg-[#D4AF37] delay-1000" style={{ width: 52 }} />

            {/* Badge de IA */}
            <div className="absolute top-4 right-4 px-2 py-1 rounded-full border border-[#D4AF37]/30 bg-black/60 backdrop-blur-sm">
              <span className="text-[8px] tracking-[0.25em] text-[#D4AF37] font-bold uppercase">I.A. Ativa</span>
            </div>
          </div>
        </div>

        {/* Copy headline premium */}
        <div className="text-center space-y-5 max-w-[320px]">

          {/* Pill editorial */}
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/5 backdrop-blur-sm transition-all duration-700 delay-300 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="text-[9px] tracking-[0.3em] font-bold text-[#D4AF37] uppercase">
              Inteligência de Estilo
            </span>
          </div>

          {/* Headline principal */}
          <h1
            className={`transition-all duration-1000 delay-400 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: "clamp(2.2rem, 9vw, 2.8rem)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "#ffffff",
            }}
          >
            Sua <span className="shimmer-text">Assinatura</span>
            {" "}Visual.{" "}
            <span style={{ color: "#ffffff", opacity: 0.85 }}>Revelada.</span>
          </h1>

          {/* Subtítulo editorial */}
          <p
            className={`text-sm leading-relaxed font-light transition-all duration-1000 delay-500 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ color: "rgba(255,255,255,0.45)", maxWidth: 280, margin: "0 auto" }}
          >
            A primeira inteligência de imagem que lê seu biotipo, paleta e presença — e montam looks que fazem você ser{" "}
            <span style={{ color: "rgba(212,175,55,0.8)" }}>visto.</span>
          </p>
        </div>
      </div>

      {/* ── FOOTER: CTAs + social proof ── */}
      <div
        className={`relative z-10 px-6 pb-12 space-y-5 transition-all duration-1000 delay-700 ${revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      >
        {/* CTA primário */}
        <Link href="/onboarding/intent" className="block w-full" id="btn-iniciar-analise">
          <button
            className="w-full relative overflow-hidden rounded-2xl py-4 text-sm font-bold tracking-[0.15em] uppercase transition-all duration-300 active:scale-[0.98] animate-pulse-gold"
            style={{
              background: "linear-gradient(135deg, #D4AF37 0%, #F0D060 45%, #B8960C 100%)",
              color: "#000000",
              letterSpacing: "0.15em",
            }}
          >
            {/* Brilho interno */}
            <span
              className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              }}
            />
            <span className="relative z-10">Iniciar Análise de Imagem</span>
          </button>
        </Link>

        {/* Social proof discreta */}
        <div className="flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <div className="flex items-center gap-2">
            {["Visagismo", "IA", "Paleta"].map((tag) => (
              <span
                key={tag}
                className="text-[8.5px] tracking-[0.2em] text-white/25 font-bold uppercase"
              >
                {tag} ·
              </span>
            ))}
          </div>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        {/* Nota de privacidade */}
        <p className="text-center text-[10px] text-white/20 tracking-wide">
          Sessão privada · Sem cadastro obrigatório · 100% confidencial
        </p>
      </div>
    </div>
  );
}
