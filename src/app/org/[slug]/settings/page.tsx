"use client";

import { use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, CreditCard, Globe, Image as ImageIcon, Lock, LogOut, Palette, Settings, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  readMerchantBenefitProgram,
  writeMerchantBenefitProgram,
  type MerchantBenefitProgram,
} from "@/lib/social/merchant-benefits";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

export default function MerchantSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { logout } = useAuth();
  const { slug } = use(params);
  const [saved, setSaved] = useState(false);
  const [benefitProgram, setBenefitProgram] = useState<MerchantBenefitProgram>(() => readMerchantBenefitProgram(slug));
  const orgBase = `/org/${slug}`;

  useEffect(() => {
    setBenefitProgram(readMerchantBenefitProgram(slug));
  }, [slug]);

  const handleSave = () => {
    writeMerchantBenefitProgram(slug, benefitProgram);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const navItems = [
    { href: `${orgBase}/settings#identidade`, icon: <Globe size={16} />, label: "Loja & Branding", active: true },
    { href: `${orgBase}/settings#seguranca`, icon: <Lock size={16} />, label: "Segurança & Senha" },
    { href: `${orgBase}/settings#plano`, icon: <CreditCard size={16} />, label: "Plano & Faturamento" },
    { href: `${orgBase}/settings#conta`, icon: <Settings size={16} />, label: "Conta" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
        <Link href={`${orgBase}/dashboard`} className="flex items-center gap-3 px-2 group">
          <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">Dashboard</span>
        </Link>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>

        <button onClick={logout} className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 group hover:bg-red-500/10 transition-colors">
          <LogOut size={16} className="text-red-500" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-red-500">Sair da conta</span>
            <span className="text-[8px] text-red-500/40 uppercase tracking-widest leading-none">Encerrar sessão</span>
          </div>
        </button>
      </aside>

      <main className="flex-1 p-12 overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between mb-16 gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-px h-6 bg-[#D4AF37]" />
              <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">Maison Elite Configurações</Text>
            </div>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">
              Gestão de Identidade
            </Heading>
          </div>
          <VenusButton onClick={handleSave} variant="solid" className="bg-white text-black rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">
            {saved ? "Salvo" : "Salvar alterações"}
          </VenusButton>
        </header>

        <div className="max-w-2xl space-y-12">
          <section id="identidade" className="space-y-8">
            <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
              Identidade da Loja
            </Heading>

            <div className="grid grid-cols-1 gap-8">
              <div className="grid grid-cols-1 gap-4 rounded-[40px] border border-white/5 bg-white/[0.03] p-5 sm:grid-cols-2 sm:p-8">
                <div className="space-y-4 rounded-[32px] border border-white/5 bg-black/20 p-5">
                  <div className="flex items-center justify-between">
                    <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Logo da loja</Text>
                    <ImageIcon size={16} className="text-white/30" />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/5">
                      <img src="https://i.pravatar.cc/150?u=org_logo" className="h-full w-full object-cover" alt="" />
                    </div>
                    <div className="space-y-1">
                      <Text className="text-lg font-serif text-white tracking-tight">Maison Elite</Text>
                      <Text className="text-[10px] uppercase tracking-widest text-white/30">Editável pelo lojista</Text>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-[32px] border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-5">
                  <div className="flex items-center justify-between">
                    <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Marca da plataforma</Text>
                    <span className="rounded-full border border-[#D4AF37]/20 bg-black/30 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Fixa</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-[#D4AF37]/20 bg-black/30 text-[#D4AF37]">
                      <span className="text-2xl font-serif">V</span>
                    </div>
                    <div className="space-y-1">
                      <Text className="text-lg font-serif text-white tracking-tight">InovaCortex</Text>
                      <Text className="text-[10px] uppercase tracking-widest text-white/30">A assinatura aparece em todo material social</Text>
                    </div>
                  </div>
                </div>

              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 ml-4">Nome da instância</label>
                  <input type="text" defaultValue="Maison Elite" className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 ml-4">Bio curta</label>
                  <textarea
                    defaultValue="Curadoria de luxo silencioso para autoridade e elegância contemporânea."
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-[32px] p-6 text-sm text-white focus:border-[#D4AF37]/40 outline-none transition-all resize-none"
                  />
                </div>
              </div>
              <Text className="text-[10px] uppercase tracking-[0.3em] text-white/30">
                A identidade da loja pode mudar. A assinatura InovaCortex permanece fixa em todos os materiais de compartilhamento.
              </Text>
            </div>
          </section>

          <section id="beneficios" className="space-y-6">
            <div className="space-y-2">
              <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">
                Benefícios ao compartilhar
              </Heading>
              <Text className="text-sm text-white/50 leading-relaxed">
                Defina o que o cliente desbloqueia quando posta a experiência. Esses benefícios aparecem na arte, na legenda e no fluxo de engajamento.
              </Text>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[32px] border border-white/5 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Text className="text-[9px] uppercase font-bold tracking-[0.35em] text-[#D4AF37]">Headline da campanha</Text>
                    <Text className="text-sm text-white/60">Texto principal exibido no share e no resultado.</Text>
                  </div>
                  <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
                    Editável
                  </span>
                </div>
                <input
                  type="text"
                  value={benefitProgram.headline}
                  onChange={(event) => setBenefitProgram((current) => ({ ...current, headline: event.target.value }))}
                  className="mt-4 w-full h-14 bg-black/30 border border-white/10 rounded-3xl px-5 text-sm text-white outline-none transition-all focus:border-[#D4AF37]/40"
                />
              </div>

              <div className="rounded-[32px] border border-white/5 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Text className="text-[9px] uppercase font-bold tracking-[0.35em] text-[#D4AF37]">Mensagem de contexto</Text>
                    <Text className="text-sm text-white/60">Linha curta que explica o valor para quem está postando.</Text>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/50">
                    App social
                  </span>
                </div>
                <textarea
                  value={benefitProgram.intro}
                  onChange={(event) => setBenefitProgram((current) => ({ ...current, intro: event.target.value }))}
                  className="mt-4 w-full h-28 bg-black/30 border border-white/10 rounded-[28px] p-5 text-sm text-white outline-none transition-all focus:border-[#D4AF37]/40 resize-none"
                />
              </div>

              <div className="rounded-[32px] border border-white/5 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Text className="text-[9px] uppercase font-bold tracking-[0.35em] text-[#D4AF37]">CTA social fixa</Text>
                    <Text className="text-sm text-white/60">A chamada que deve aparecer no material compartilhável.</Text>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-white/50">
                    Marca da loja + InovaCortex
                  </span>
                </div>
                <input
                  type="text"
                  value={benefitProgram.cta}
                  onChange={(event) => setBenefitProgram((current) => ({ ...current, cta: event.target.value }))}
                  className="mt-4 w-full h-14 bg-black/30 border border-white/10 rounded-3xl px-5 text-sm text-white outline-none transition-all focus:border-[#D4AF37]/40"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {benefitProgram.benefits.map((benefit, index) => (
                  <div key={index} className="rounded-[32px] border border-[#D4AF37]/10 bg-[#D4AF37]/5 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <Text className="text-[9px] uppercase font-bold tracking-[0.35em] text-[#D4AF37]">Benefício {index + 1}</Text>
                      <span className="rounded-full border border-[#D4AF37]/20 bg-black/20 px-3 py-1 text-[8px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
                        Loja define
                      </span>
                    </div>
                    <input
                      type="text"
                      value={benefit.title}
                      onChange={(event) =>
                        setBenefitProgram((current) => ({
                          ...current,
                          benefits: current.benefits.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item
                          ),
                        }))
                      }
                      className="w-full h-12 bg-black/30 border border-white/10 rounded-2xl px-4 text-sm text-white outline-none transition-all focus:border-[#D4AF37]/40"
                      placeholder="Título do benefício"
                    />
                    <textarea
                      value={benefit.description}
                      onChange={(event) =>
                        setBenefitProgram((current) => ({
                          ...current,
                          benefits: current.benefits.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item
                          ),
                        }))
                      }
                      className="w-full h-24 bg-black/30 border border-white/10 rounded-[22px] p-4 text-xs text-white outline-none transition-all focus:border-[#D4AF37]/40 resize-none"
                      placeholder="Como esse benefício aparece"
                    />
                    <input
                      type="text"
                      value={benefit.unlock}
                      onChange={(event) =>
                        setBenefitProgram((current) => ({
                          ...current,
                          benefits: current.benefits.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, unlock: event.target.value } : item
                          ),
                        }))
                      }
                      className="w-full h-11 bg-black/30 border border-white/10 rounded-2xl px-4 text-[11px] text-white outline-none transition-all focus:border-[#D4AF37]/40"
                      placeholder="Quando isso desbloqueia"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="plano" className="p-10 rounded-[60px] bg-gradient-to-br from-[#D4AF37]/10 via-transparent to-transparent border border-[#D4AF37]/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Palette size={120} className="text-[#D4AF37]" />
            </div>
            <div className="space-y-6 relative z-10">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[9px] font-bold uppercase tracking-widest">Plano Platinum</span>
                <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">Renovação em 12 dias</span>
              </div>
              <div className="space-y-2">
                <Heading as="h4" className="text-3xl tracking-tighter uppercase leading-none">
                  Acesso total ativado
                </Heading>
                <Text className="text-xs text-white/60 leading-relaxed">Você possui limites expandidos para geração de Try-On e Enrichment AI ilimitado.</Text>
              </div>
              <VenusButton variant="outline" className="border-white/20 text-white rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">
                Gerenciar faturamento
              </VenusButton>
            </div>
          </section>

          <section id="seguranca" className="space-y-6">
            <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-red-500/40 font-bold">
              Protocolos críticos
            </Heading>
            <div className="p-8 rounded-[48px] bg-red-500/[0.03] border border-red-500/10 flex items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <ShieldAlert size={24} />
                </div>
                <div className="flex flex-col">
                  <Heading as="h4" className="text-base tracking-tight uppercase">
                    Reset master password
                  </Heading>
                  <Text className="text-[10px] text-white/30 uppercase tracking-widest font-bold font-mono leading-none">Last changed 42 days ago</Text>
                </div>
              </div>
              <VenusButton variant="outline" className="border-red-500/20 text-red-500 hover:bg-red-500/10 rounded-full text-[10px] tracking-widest uppercase font-bold h-12 px-8">
                Solicitar reset
              </VenusButton>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${
        active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}
