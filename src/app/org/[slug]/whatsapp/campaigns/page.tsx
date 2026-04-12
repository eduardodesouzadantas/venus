"use client";

import { useState } from "react";
import { MessageSquare, Target, Zap, Clock, ChevronRight, Activity, Sparkles, Send, Edit3, Trash2, History, Filter, Plus, Signal, MousePointer2 } from "lucide-react";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import Link from "next/link";
import { generateWACopy } from "@/lib/whatsapp/copy";
import { CampaignObjective, AudienceSegment, WhatsAppCampaign } from "@/types/whatsapp";

export default function MerchantWhatsAppCampaigns({ params }: { params: { slug: string } }) {
   const [showBuilder, setShowBuilder] = useState(false);
   const [activeTab, setActiveTab] = useState<"active" | "history">("active");

   const [campaign, setCampaign] = useState<Partial<WhatsAppCampaign>>({
      name: "",
      objective: "novidades",
      segment: "inativos",
      status: "draft",
      message: { headline: "", body: "", cta: "", tone: "premium" }
   });

   const handleGenerateAI = () => {
      const copy = generateWACopy(
         campaign.objective as CampaignObjective,
         campaign.segment as AudienceSegment,
         campaign.message?.tone || "premium"
      );
      setCampaign({ ...campaign, message: { ...campaign.message!, ...copy } });
   };

   const campaignsHistory: WhatsAppCampaign[] = [
      {
         id: "1",
         name: "Retomada Inverno",
         objective: "recuperar_inativo",
         segment: "inativos",
         status: "sent",
         message: { headline: "Retorne à Maison", body: "Temos novos cortes exclusivos...", cta: "Ver Coleção", tone: "premium" },
         metrics: { recipients: 450, clicks: 120, responses: 12, repurchases: 8 },
         createdAt: "2026-03-24",
         lastSentAt: "2026-03-26"
      }
   ];

   return (
      <div className="min-h-screen bg-black text-white p-12 overflow-y-auto no-scrollbar">
         <div className="max-w-6xl mx-auto space-y-12">

            <header className="flex items-center justify-between">
               <div className="space-y-1">
                  <div className="flex items-center gap-2">
                     <div className="w-px h-6 bg-[#C9A84C]" />
                     <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C]">WhatsApp Marketing Executive</Text>
                  </div>
                  <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">Reengajamento & Recompra</Heading>
               </div>
               <div className="flex gap-4">
                  <div className="px-6 rounded-full border border-white/5 bg-white/[0.02] flex items-center gap-4 h-12">
                     <div className="flex items-center gap-2">
                        <Signal size={14} className="text-green-500" />
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">WA Proxy Health: Excellent</span>
                     </div>
                     <div className="w-px h-4 bg-white/10" />
                     <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest">Connect: Active</span>
                  </div>
                  {!showBuilder && (
                     <VenusButton onClick={() => setShowBuilder(true)} variant="solid" className="bg-white text-black h-12 px-8 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-3">
                        <Plus size={16} /> Nova Campanha
                     </VenusButton>
                  )}
               </div>
            </header>

            {showBuilder ? (
               <section className="grid grid-cols-5 gap-12 animate-in slide-in-from-bottom-4 duration-700">
                  {/* Left: Configuration */}
                  <div className="col-span-2 space-y-10 border-r border-white/5 pr-12 pb-20">
                     <div className="space-y-6">
                        <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Configuração da Meta</Heading>
                        <div className="grid grid-cols-1 gap-4">
                           <div className="space-y-2">
                              <label className="text-[9px] uppercase font-bold tracking-widest text-[#C9A84C] ml-4 italic">Objetivo da Campanha</label>
                              <select
                                 value={campaign.objective}
                                 onChange={(e) => setCampaign({ ...campaign, objective: e.target.value as CampaignObjective })}
                                 className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-xs text-white focus:border-[#C9A84C]/40 outline-none transition-all appearance-none uppercase tracking-widest font-bold">
                                 <option value="novidades">Lançamentos & Novidades</option>
                                 <option value="recompra">Estimular Recompra (Fidelização)</option>
                                 <option value="look_da_semana">Desejo Semanal (Curadoria)</option>
                                 <option value="recuperar_inativo">Recuperação de Inativos</option>
                                 <option value="cross_sell">Acessórios & Cross-sell</option>
                                 <option value="pos_compra">Relacionamento Pós-compra</option>
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 ml-4">Segmentação da Audiência</label>
                              <select
                                 value={campaign.segment}
                                 onChange={(e) => setCampaign({ ...campaign, segment: e.target.value as AudienceSegment })}
                                 className="w-full h-14 bg-white/5 border border-white/10 rounded-3xl px-6 text-xs text-white focus:border-white/20 outline-none transition-all appearance-none uppercase tracking-widest font-bold">
                                 <option value="inativos">Clientes Inativos (+30 dias)</option>
                                 <option value="alta_intencao">Alta Intenção (Clicks Recentes)</option>
                                 <option value="try_on_users">Usuários Frequentes do Try-On</option>
                                 <option value="bundle_buyers">Compradores de Looks Completos</option>
                                 <option value="high_ticket">Top 10% Ticket Médio</option>
                              </select>
                           </div>
                           <div className="p-6 rounded-[32px] bg-[#C9A84C]/5 border border-[#C9A84C]/20 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Target size={16} className="text-[#C9A84C]" />
                                 <span className="text-[10px] uppercase font-bold tracking-widest text-[#C9A84C]">Alcance Estimado</span>
                              </div>
                              <span className="text-xl font-serif text-white tracking-widest">4.2k <span className="text-[10px] font-sans text-white/30 tracking-normal">users</span></span>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <Heading as="h3" className="text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Tom da IA</Heading>
                        <div className="grid grid-cols-2 gap-3">
                           {['premium', 'elegant', 'persuasive', 'concise'].map(t => (
                              <button
                                 key={t}
                                 onClick={() => setCampaign({ ...campaign, message: { ...campaign.message!, tone: t as any } })}
                                 className={`py-3 rounded-2xl border text-[9px] font-bold uppercase tracking-widest transition-all ${campaign.message?.tone === t ? "bg-white text-black border-white shadow-xl" : "bg-white/5 border-white/5 text-white/40 hover:text-white"}`}>
                                 {t}
                              </button>
                           ))}
                        </div>
                        <VenusButton onClick={handleGenerateAI} variant="solid" className="w-full py-6 h-auto bg-[#C9A84C] text-black rounded-full text-[10px] font-bold uppercase tracking-[0.4em] flex items-center justify-center gap-2 group active:scale-95 transition-all">
                           <Sparkles size={16} /> Gerar Script IA
                        </VenusButton>
                     </div>
                  </div>

                  {/* Right: Message Preview & CRM */}
                  <div className="col-span-3 space-y-12">
                     <div className="flex items-center justify-between">
                        <Heading as="h3" className="text-2xl tracking-tighter uppercase">Preview da Conversa</Heading>
                        <div className="flex gap-3">
                           <VenusButton onClick={() => setShowBuilder(false)} variant="outline" className="border-white/10 text-white/40 rounded-full h-12 px-6 text-[10px] uppercase tracking-widest font-bold">Cancelar</VenusButton>
                           <VenusButton variant="solid" className="bg-white text-black rounded-full h-12 px-10 text-[10px] uppercase tracking-[0.3em] font-bold">Programar Envio</VenusButton>
                        </div>
                     </div>

                     {/* WhatsApp Simulation UI */}
                     <div className="w-full max-w-sm rounded-[48px] bg-[#075E54] p-3 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-[#075E54]/40 backdrop-blur-3xl z-0" />
                        <div className="relative z-10 w-full h-[500px] overflow-hidden rounded-[40px] bg-[#E5DDD5] flex flex-col">
                           <div className="h-14 w-full bg-[#075E54] flex items-center px-6 gap-3 shadow-md">
                              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border border-white/10 font-serif font-bold text-white text-xs">V</div>
                              <div className="flex flex-col">
                                 <span className="text-[10px] text-white font-bold leading-none">Venus Engine Executive</span>
                                 <span className="text-[7px] text-white/60 tracking-widest uppercase font-bold leading-none mt-0.5">Online</span>
                              </div>
                           </div>

                           <div className="flex-1 p-6 flex flex-col justify-end space-y-6">
                              <div className="max-w-[85%] bg-white rounded-2xl p-4 shadow-sm relative animate-in slide-in-from-left-4 duration-1000">
                                 <div className="absolute top-0 -left-1 w-2 h-2 bg-white rotate-45" />
                                 <Heading as="h4" className="text-xs tracking-tight text-black font-bold uppercase mb-2">{campaign.message?.headline || "Preview Headline..."}</Heading>
                                 <Text className="text-[11px] text-black/60 leading-relaxed">
                                    {campaign.message?.body || "Aguardando geração de script AI para sua audiência..."}
                                 </Text>
                                 <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-[#075E54] uppercase tracking-widest underline">{campaign.message?.cta || "CTA Placeholder"}</span>
                                    <span className="text-[7px] text-black/20 font-mono">14:42 ✓✓</span>
                                 </div>
                              </div>
                              <div className="self-end max-w-[85%] bg-[#DCF8C6] rounded-2xl p-4 shadow-sm relative opacity-20">
                                 <div className="absolute top-0 -right-1 w-2 h-2 bg-[#DCF8C6] rotate-45" />
                                 <Text className="text-[11px] text-black/40 italic">O cliente receberá o link para ver o look em si mesmo...</Text>
                              </div>
                           </div>

                           <div className="h-16 w-full bg-[#F0F0F0] flex items-center px-6 gap-4">
                              <div className="flex-1 h-10 rounded-full bg-white border border-black/5" />
                              <div className="w-10 h-10 rounded-full bg-[#128C7E] flex items-center justify-center text-white shadow-lg">
                                 <Send size={16} />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </section>
            ) : (
               <>
                  {/* CRM Summary & Active Overview (Part 5) */}
                  <div className="grid grid-cols-4 gap-6">
                     <div className="col-span-1 p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-6">
                        <div className="flex items-center gap-3 text-[#C9A84C]">
                           <Zap size={18} />
                           <Heading as="h4" className="text-[9px] uppercase font-bold tracking-widest leading-none">Capacidade Semanal</Heading>
                        </div>
                        <div className="space-y-4">
                           <div className="flex items-end justify-between px-1">
                              <span className="text-3xl font-serif tracking-tighter">8.4k</span>
                              <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest pb-1">msgs left</span>
                           </div>
                           <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-[#C9A84C] w-[65%]" />
                           </div>
                        </div>
                     </div>
                     <div className="col-span-1 p-8 rounded-[48px] bg-white/[0.03] border border-white/5 space-y-6">
                        <div className="flex items-center gap-3 text-green-500">
                           <MousePointer2 size={18} />
                           <Heading as="h4" className="text-[9px] uppercase font-bold tracking-widest leading-none">AOV via WhatsApp</Heading>
                        </div>
                        <div className="flex items-baseline gap-2">
                           <span className="text-3xl font-serif tracking-tighter">R$ 2.1k</span>
                           <ArrowUpRight size={14} className="text-green-500" />
                        </div>
                        <Text className="text-[10px] text-white/20 uppercase tracking-widest font-bold">+14% vs benchmark</Text>
                     </div>
                  </div>

                  <section className="space-y-8">
                     <div className="flex items-center justify-between px-2">
                        <div className="flex gap-8">
                           <button
                              onClick={() => setActiveTab('active')}
                              className={`text-xs uppercase tracking-[0.4em] font-bold transition-all ${activeTab === 'active' ? "text-[#C9A84C]" : "text-white/20 hover:text-white"}`}>
                              Ativas
                           </button>
                           <button
                              onClick={() => setActiveTab('history')}
                              className={`text-xs uppercase tracking-[0.4em] font-bold transition-all ${activeTab === 'history' ? "text-[#C9A84C]" : "text-white/20 hover:text-white"}`}>
                              Histórico
                           </button>
                        </div>
                        <button className="flex items-center gap-4 text-[10px] text-white/20 hover:text-white transition-colors">
                           <Filter size={14} /> <span className="uppercase font-bold tracking-widest underline underline-offset-4">Filtrar por Status</span>
                        </button>
                     </div>

                     <div className="grid grid-cols-1 gap-4">
                        {campaignsHistory.map(c => (
                           <div key={c.id} className="p-8 rounded-[48px] bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all relative overflow-hidden">
                              {c.status === 'sent' && <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-3xl -mr-12 -mt-12" />}
                              <div className="flex items-center gap-10">
                                 <div className="w-16 h-16 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
                                    <MessageSquare size={24} className="text-[#C9A84C]/40" />
                                 </div>
                                 <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-3">
                                       <Heading as="h4" className="text-xl tracking-tight uppercase leading-none">{c.name}</Heading>
                                       <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[8px] font-bold uppercase tracking-widest">Enviada</span>
                                    </div>
                                    <span className="text-[9px] uppercase tracking-widest text-white/20 font-bold">{c.objective.split('_').join(' ')} · {c.segment} Segment</span>
                                 </div>
                              </div>

                              <div className="flex items-center gap-20">
                                 <div className="grid grid-cols-3 gap-12">
                                    <Metric value={c.metrics?.recipients} label="Enviadas" />
                                    <Metric value={c.metrics?.clicks} label="Clicks" highlight />
                                    <Metric value={c.metrics?.repurchases} label="Repurchase" highlight />
                                 </div>
                                 <div className="flex gap-3">
                                    <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-white transition-colors"><Edit3 size={16} /></button>
                                    <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20 hover:text-white transition-colors"><ChevronRight size={16} /></button>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </section>
               </>
            )}
         </div>
      </div>
   );
}

function Metric({ value, label, highlight = false }: { value: any, label: string, highlight?: boolean }) {
   return (
      <div className="flex flex-col items-end">
         <span className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-1">{label}</span>
         <span className={`text-xl font-serif ${highlight ? "text-[#C9A84C]" : "text-white/60"}`}>{value}</span>
      </div>
   );
}

function ArrowUpRight(props: any) {
   return (
      <svg
         {...props}
         xmlns="http://www.w3.org/2000/svg"
         width="24"
         height="24"
         viewBox="0 0 24 24"
         fill="none"
         stroke="currentColor"
         strokeWidth="2"
         strokeLinecap="round"
         strokeLinejoin="round"
      >
         <path d="M7 7h10v10" />
         <path d="M7 17 17 7" />
      </svg>
   );
}
