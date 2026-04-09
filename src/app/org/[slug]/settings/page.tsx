"use client";

import { use, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Globe, Image as ImageIcon, Lock, LogOut, Settings, Share2 } from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { useAuth } from "@/lib/auth/AuthContext";

type MerchantOrgSettings = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  whatsapp_number: string | null;
  plan_id: string | null;
  status: string;
};

type SettingsResponse =
  | {
      ok: true;
      org: MerchantOrgSettings;
    }
  | {
      error?: string;
    };

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

function normalizeHex(value: string) {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : "#D4AF37";
}

export default function MerchantSettings({ params }: { params: Promise<{ slug: string }> }) {
  const { logout } = useAuth();
  const { slug } = use(params);
  const orgBase = `/org/${slug}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#D4AF37");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/org/${slug}/settings`, {
          headers: { "Cache-Control": "no-store" },
        });
        const payload = (await response.json().catch(() => null)) as SettingsResponse | null;

        if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
          throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel carregar as configuracoes");
        }

        if (cancelled) return;

        setOrgName(payload.org.name || "");
        setLogoUrl(payload.org.logo_url);
        setPrimaryColor(payload.org.primary_color || "#D4AF37");
        setWhatsappNumber(payload.org.whatsapp_number || "");
        setPlanId(payload.org.plan_id || null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar configuracoes");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const displayLogo = useMemo(() => {
    if (clearLogo && !logoPreview) {
      return "";
    }

    return logoPreview || logoUrl || "";
  }, [clearLogo, logoPreview, logoUrl]);

  const handleLogoChange = (file: File | null) => {
    setLogoFile(file);
    setClearLogo(false);

    if (!file) {
      setLogoPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const formData = new FormData();
      formData.set("name", orgName.trim());
      formData.set("primary_color", normalizeHex(primaryColor));
      formData.set("whatsapp_number", whatsappNumber.trim());

      if (logoFile) {
        formData.set("logo_file", logoFile);
      } else if (clearLogo) {
        formData.set("clear_logo", "1");
      }

      const response = await fetch(`/api/org/${slug}/settings`, {
        method: "PATCH",
        headers: { "Cache-Control": "no-store" },
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as SettingsResponse | null;

      if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
        throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel salvar as configuracoes");
      }

      setOrgName(payload.org.name || "");
      setLogoUrl(payload.org.logo_url);
      setPrimaryColor(payload.org.primary_color || "#D4AF37");
      setWhatsappNumber(payload.org.whatsapp_number || "");
      setPlanId(payload.org.plan_id || null);
      setLogoFile(null);
      setClearLogo(false);
      setLogoPreview(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar configuracoes");
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { href: `${orgBase}/dashboard`, icon: <ArrowLeft size={16} />, label: "Dashboard" },
    { href: `${orgBase}/settings`, icon: <Globe size={16} />, label: "Identidade", active: true },
    { href: `${orgBase}/rewards`, icon: <Share2 size={16} />, label: "Recompensas" },
    { href: `${orgBase}/settings#whatsapp`, icon: <Lock size={16} />, label: "WhatsApp" },
    { href: `${orgBase}/settings#plan`, icon: <Settings size={16} />, label: "Plano" },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-64 border-r border-white/5 flex flex-col p-6 space-y-10 sticky top-0 h-screen">
        <Link href={`${orgBase}/dashboard`} className="flex items-center gap-3 px-2 group">
          <ArrowLeft size={16} className="text-white/20 group-hover:text-white transition-colors" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">
            Dashboard
          </span>
        </Link>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}
        </nav>

        <button
          onClick={logout}
          className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 group hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} className="text-red-500" />
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-bold text-red-500">Sair da conta</span>
            <span className="text-[8px] text-red-500/40 uppercase tracking-widest leading-none">Encerrar sessao</span>
          </div>
        </button>
      </aside>

      <main className="flex-1 p-8 md:p-12 overflow-y-auto no-scrollbar">
        <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between mb-10">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#D4AF37]">
              {slug} Configuracoes
            </Text>
            <Heading as="h1" className="text-3xl md:text-4xl tracking-tighter uppercase leading-none">
              Identidade da loja
            </Heading>
            <Text className="text-sm text-white/50 max-w-2xl">
              Ajuste a identidade do lojista, o logo exibido no app e os dados basicos de contato.
            </Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`${orgBase}/rewards`}>
              <VenusButton variant="outline" className="h-12 px-5 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium border-white/10">
                Abrir recompensas
              </VenusButton>
            </Link>
            <VenusButton
              onClick={handleSave}
              disabled={loading || saving}
              variant="solid"
              className="h-12 px-6 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium bg-[#D4AF37] text-black"
            >
              {saving ? "Salvando..." : saved ? "Salvo" : "Salvar alteracoes"}
            </VenusButton>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <Panel title="Identidade da loja" description="Logo, nome e cor principal usados no painel e nos materiais sociais.">
              <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                <div className="space-y-3">
                  <div className="flex h-56 items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
                    {displayLogo ? (
                      <img src={displayLogo} alt={orgName || slug} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/25">
                        <ImageIcon size={44} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80 transition-colors hover:bg-white/5">
                      Enviar logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleLogoChange(event.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview(null);
                        setClearLogo(true);
                      }}
                      className="rounded-full border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50 transition-colors hover:bg-white/5"
                    >
                      Remover logo
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="space-y-2">
                    <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">Nome da loja</span>
                    <input
                      value={orgName}
                      onChange={(event) => setOrgName(event.target.value)}
                      className="h-14 w-full rounded-3xl border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                      placeholder="Nome da sua loja"
                    />
                  </label>

                  <div className="space-y-2">
                    <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">Cor principal</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={normalizeHex(primaryColor)}
                        onChange={(event) => setPrimaryColor(event.target.value)}
                        className="h-14 w-16 rounded-2xl border border-white/10 bg-transparent p-1"
                      />
                      <input
                        value={primaryColor}
                        onChange={(event) => setPrimaryColor(event.target.value)}
                        className="h-14 flex-1 rounded-3xl border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                        placeholder="#D4AF37"
                      />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Slug</span>
                      <span className="font-mono text-xs text-white/70">{slug}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Plano</span>
                      <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#D4AF37]">
                        {planId || "sem plano"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              id="whatsapp"
              title="Configuracao do WhatsApp"
              description="Numero usado como contato principal e como ponto de apoio para o fluxo do cliente."
            >
              <label className="space-y-2">
                <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">Numero do WhatsApp</span>
                <input
                  value={whatsappNumber}
                  onChange={(event) => setWhatsappNumber(event.target.value)}
                  className="h-14 w-full rounded-3xl border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition-colors focus:border-[#D4AF37]/40"
                  placeholder="+55 11 99999-9999"
                />
              </label>
            </Panel>
          </section>

          <aside className="space-y-6">
            <Panel title="Acesso rapido" description="Pontos que o lojista costuma usar depois do setup inicial.">
              <div className="space-y-3">
                <QuickLink href={`${orgBase}/rewards`} label="Recompensas do loop viral" description="Criar e ativar share_rewards." />
                <QuickLink href={`${orgBase}/catalog`} label="Produtos" description="Cadastrar e revisar o catalogo da loja." />
                <QuickLink href={`${orgBase}/whatsapp/inbox`} label="WhatsApp" description="Validar integracao e conversa de vendas." />
              </div>
            </Panel>

            <Panel id="plan" title="Status da conta" description="Resumo do plano e do estado atual da org.">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-white/45">Plano</span>
                  <span className="font-medium text-white">{planId || "sem dados"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-white/45">Status</span>
                  <span className="font-medium text-white">{loading ? "carregando" : "ativo"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-white/45">Identidade</span>
                  <span className="font-medium text-white">{logoUrl ? "logo configurado" : "sem logo"}</span>
                </div>
              </div>
            </Panel>
          </aside>
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

function Panel({
  title,
  description,
  children,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="space-y-4 rounded-[40px] border border-white/5 bg-white/[0.03] p-5 md:p-7">
      <div className="space-y-1">
        <Heading as="h2" className="text-xl tracking-tight">
          {title}
        </Heading>
        {description ? <Text className="text-sm text-white/50 leading-relaxed">{description}</Text> : null}
      </div>
      {children}
    </section>
  );
}

function QuickLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href} className="block rounded-3xl border border-white/10 bg-black/30 p-4 transition-colors hover:bg-white/5">
      <div className="text-sm font-medium text-white">{label}</div>
      <div className="mt-1 text-xs text-white/45">{description}</div>
    </Link>
  );
}
