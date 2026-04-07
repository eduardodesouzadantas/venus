"use client";

import { use, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Database, Link as LinkIcon, MessageSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

type MetaConnectionState = {
  connected: boolean;
  org_slug: string;
  org_name?: string;
  webhook_url?: string;
  integration?: {
    phone_number_id: string;
    business_account_id: string;
    display_phone_number?: string | null;
    verified_name?: string | null;
    quality_rating?: string | null;
  } | null;
};

type ConnectFormState = {
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
};

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="ml-4 text-[9px] font-bold uppercase tracking-[0.35em] text-white/30">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full rounded-3xl border border-white/10 bg-white/[0.04] px-5 text-sm text-white outline-none transition-all placeholder:text-white/15 focus:border-[#D4AF37]/40"
      />
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-white/5 bg-black/30 p-5">
      <Text className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/25">{label}</Text>
      <div className="mt-2 break-words font-serif text-sm text-white/85">{value}</div>
    </div>
  );
}

function buildWebhookUrl(request: Request) {
  return `${new URL(request.url).origin}/api/meta/whatsapp/webhook`;
}

export default function MerchantIntegrations({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const orgBase = `/org/${slug}`;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [metaState, setMetaState] = useState<MetaConnectionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectFormState>({
    accessToken: "",
    businessAccountId: "",
    phoneNumberId: "",
  });

  useEffect(() => {
    let cancelled = false;

    const loadConnection = async () => {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/org/${slug}/whatsapp/meta-connect`, {
        headers: {
          "Cache-Control": "no-store",
        },
      });

      const payload = await response.json().catch(() => null);

      if (cancelled) return;

      if (response.ok && payload) {
        setMetaState(payload as MetaConnectionState);
        if (payload.integration) {
          setForm((current) => ({
            ...current,
            businessAccountId: payload.integration.business_account_id || current.businessAccountId,
            phoneNumberId: payload.integration.phone_number_id || current.phoneNumberId,
          }));
        }
      } else {
        setMetaState(null);
        setError(payload?.error || "Nao foi possivel carregar a conexao Meta.");
      }

      setIsLoading(false);
    };

    void loadConnection();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleConnectMeta = async () => {
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/org/${slug}/whatsapp/meta-connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: form.accessToken,
        business_account_id: form.businessAccountId,
        phone_number_id: form.phoneNumberId,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error || "Nao foi possivel conectar na Meta.");
      setIsSaving(false);
      return;
    }

    setMetaState(payload as MetaConnectionState);
    setForm((current) => ({ ...current, accessToken: "" }));
    setIsSaving(false);
  };

  const handleDisconnectMeta = async () => {
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/org/${slug}/whatsapp/meta-connect`, {
      method: "DELETE",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setError(payload?.error || "Nao foi possivel desconectar a Meta.");
      setIsSaving(false);
      return;
    }

    setMetaState({
      connected: false,
      org_slug: slug,
      webhook_url: payload?.webhook_url,
      integration: null,
    });
    setIsSaving(false);
  };

  const navItems = [
    { href: `${orgBase}/integrations#whatsapp`, icon: <MessageSquare size={16} />, label: "WhatsApp oficial", active: true },
    { href: `${orgBase}/integrations#api`, icon: <LinkIcon size={16} />, label: "API Corporativa" },
    { href: `${orgBase}/integrations#crm`, icon: <Database size={16} />, label: "CRM Connect" },
  ];

  return (
    <div className="flex min-h-screen bg-black text-white">
      <aside className="sticky top-0 flex h-screen w-64 flex-col space-y-10 border-r border-white/5 p-6">
        <Link href={`${orgBase}/dashboard`} className="flex items-center gap-3 px-2 group">
          <ArrowLeft size={16} className="text-white/20 transition-colors group-hover:text-white" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 transition-colors group-hover:text-white">
            Dashboard
          </span>
        </Link>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-12 no-scrollbar">
        <header className="mb-16 flex items-center justify-between gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-px bg-[#D4AF37]" />
              <Text className="text-[10px] font-bold uppercase tracking-[0.4em] text-[#D4AF37]">
                Maison Elite Ecosystem
              </Text>
            </div>
            <Heading as="h1" className="text-3xl tracking-tighter uppercase whitespace-nowrap">
              WhatsApp oficial
            </Heading>
          </div>

          <Link
            href={`${orgBase}/whatsapp/inbox`}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-8 py-3.5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all hover:bg-white/5 hover:text-white"
          >
            Abrir Inbox
          </Link>
        </header>

        <div className="max-w-5xl space-y-12">
          <section id="whatsapp" className="space-y-6">
            <div className="flex items-end justify-between gap-8">
              <div className="space-y-2">
                <Heading as="h3" className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
                  Ativação oficial
                </Heading>
                <Text className="max-w-2xl text-sm leading-relaxed text-white/40">
                  Conecte a linha oficial da Meta com um token, o Business Account ID e o Phone Number ID. A partir daí, o
                  inbox e a automação usam a API oficial.
                </Text>
              </div>

              <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[9px] uppercase tracking-widest text-white/40">
                Webhook oficial pronto
              </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6 rounded-[48px] border border-white/5 bg-white/[0.03] p-8">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-[28px] transition-all duration-700 ${
                        metaState?.connected ? "bg-green-500 text-black shadow-[0_0_40px_rgba(34,197,94,0.25)]" : "bg-white/5 text-white/20"
                      }`}
                    >
                      <MessageSquare size={30} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Heading as="h4" className="text-2xl tracking-tighter uppercase leading-none">
                        WhatsApp Cloud API
                      </Heading>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">
                        {metaState?.connected ? "Conectado e validado" : isLoading ? "Carregando conexão..." : "Aguardando ativação"}
                      </span>
                    </div>
                  </div>

                  <VenusButton
                    onClick={metaState?.connected ? handleDisconnectMeta : handleConnectMeta}
                    variant={metaState?.connected ? "outline" : "solid"}
                    className={`h-10 rounded-full px-6 text-[9px] font-bold uppercase tracking-widest transition-all ${
                      metaState?.connected ? "border-red-500/20 bg-red-500/5 text-red-500" : "bg-[#D4AF37] text-black"
                    }`}
                    disabled={isSaving}
                  >
                    {isSaving ? "Processando..." : metaState?.connected ? "Desconectar" : "Conectar na Meta"}
                  </VenusButton>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field
                      label="Meta Access Token"
                      placeholder="EAA..."
                      value={form.accessToken}
                      onChange={(value) => setForm((current) => ({ ...current, accessToken: value }))}
                    />
                    <Field
                      label="Business Account ID"
                      placeholder="123456789"
                      value={form.businessAccountId}
                      onChange={(value) => setForm((current) => ({ ...current, businessAccountId: value }))}
                    />
                    <Field
                      label="Phone Number ID"
                      placeholder="123456789"
                      value={form.phoneNumberId}
                      onChange={(value) => setForm((current) => ({ ...current, phoneNumberId: value }))}
                    />
                  </div>

                  <div className="rounded-[32px] border border-white/5 bg-black/40 p-6 space-y-3">
                    <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Como ativar</Text>
                    <ul className="list-inside list-disc space-y-2 text-sm leading-relaxed text-white/45">
                      <li>cole o token da Meta com permissão de mensageria</li>
                      <li>cole o Business Account ID da conta WhatsApp</li>
                      <li>cole o Phone Number ID da linha oficial</li>
                      <li>clique em conectar</li>
                    </ul>
                  </div>

                  {error && (
                    <div className="rounded-[28px] border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-200">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[48px] border border-white/5 bg-white/[0.03] p-8 space-y-4">
                  <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/30">Status da loja</Text>
                  <Heading as="h4" className="text-2xl tracking-tighter uppercase leading-none">
                    {metaState?.connected ? "Pronta para operar" : "Ainda não conectada"}
                  </Heading>
                  <Text className="text-sm leading-relaxed text-white/40">
                    Assim que a linha oficial estiver ativa, o inbox, os envios e a automação usam a API oficial da Meta.
                  </Text>
                </div>

                <div className="rounded-[48px] border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-8 space-y-4">
                  <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Webhook da plataforma</Text>
                  <Heading as="h4" className="text-lg tracking-tight uppercase leading-tight">
                    {metaState?.webhook_url || "Webhook oficial"}
                  </Heading>
                  <Text className="text-sm leading-relaxed text-white/45">
                    No Meta App, aponte o callback para esse endpoint. O verify token é o segredo da plataforma.
                  </Text>
                </div>

                {metaState?.connected && metaState.integration ? (
                  <div className="grid grid-cols-2 gap-4">
                    <MetricBox label="Display phone" value={metaState.integration.display_phone_number || "—"} />
                    <MetricBox label="Quality rating" value={metaState.integration.quality_rating || "—"} />
                    <MetricBox label="Verified name" value={metaState.integration.verified_name || "—"} />
                    <MetricBox label="Phone number ID" value={metaState.integration.phone_number_id} />
                  </div>
                ) : (
                  <div className="rounded-[32px] border border-white/5 bg-white/[0.02] p-6 text-sm leading-relaxed text-white/40">
                    Depois de conectar, você verá o número verificado, o nome oficial e o status da linha aqui.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section id="api" className="space-y-8">
            <Heading as="h3" className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
              Roadmap de Conectividade
            </Heading>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between rounded-[48px] border border-white/5 bg-white/[0.03] p-8 opacity-40 transition-opacity hover:opacity-100 group">
                <div className="flex items-center gap-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/20">
                    <LinkIcon size={24} />
                  </div>
                  <div className="flex flex-col">
                    <Heading as="h4" className="mb-1 text-base uppercase leading-none tracking-tight">
                      API Corporativa
                    </Heading>
                    <span className="text-[8px] font-bold uppercase tracking-widest text-white/20">Em desenvolvimento</span>
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Q3 2026</span>
              </div>
            </div>
          </section>

          <section id="crm" className="flex items-start gap-4 rounded-[48px] border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-8">
            <ShieldCheck className="mt-1 h-5 w-5 flex-shrink-0 text-[#D4AF37]" />
            <div className="space-y-2">
              <Heading as="h5" className="text-sm uppercase tracking-tight">
                Acesso protegido
              </Heading>
              <Text className="text-[10px] leading-relaxed italic text-white/40">
                Os dados de conexão oficial ficam no servidor e a interface só expõe o necessário para a operação da loja.
              </Text>
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
      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 transition-all ${
        active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}
