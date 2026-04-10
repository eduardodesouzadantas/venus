import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  LayoutGrid,
  Package,
  Radar,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantBySlug, isAgencyRole, isTenantActive } from "@/lib/tenant/core";

export const dynamic = "force-dynamic";

type OnboardingSessionRow = Record<string, unknown> & {
  created_at?: string | null;
  org_id?: string | null;
};

type NavItemProps = {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
};

type RankedItem = {
  label: string;
  count: number;
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function collectRecords(row: OnboardingSessionRow) {
  return [row, asRecord(row.metadata), asRecord(row.payload), asRecord(row.data), asRecord(row.context), asRecord(row.onboarding)];
}

function readNestedString(value: unknown, path: string[]) {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) {
      return "";
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return normalize(cursor);
}

function pickString(row: OnboardingSessionRow, paths: string[][]) {
  const candidates = collectRecords(row);
  for (const candidate of candidates) {
    for (const path of paths) {
      const direct = path.length === 1 ? normalize(candidate[path[0]]) : readNestedString(candidate, path);
      if (direct) {
        return direct;
      }
    }
  }
  return "";
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.round(value)));
}

function NavItem({ href, icon, label, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-[10px] border ${
        active
          ? "bg-white text-black border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.08)]"
          : "bg-white/[0.02] text-white/45 border-white/5 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      <span className="uppercase tracking-[0.24em] font-bold">{label}</span>
    </Link>
  );
}

function StatusDot({ tone }: { tone: "green" | "amber" | "red" }) {
  const toneMap = {
    green: "bg-[#00ff88] shadow-[0_0_12px_rgba(0,255,136,0.5)]",
    amber: "bg-[#ffaa00] shadow-[0_0_12px_rgba(255,170,0,0.45)]",
    red: "bg-[#ff4444] shadow-[0_0_12px_rgba(255,68,68,0.45)]",
  };
  return <span className={`h-2 w-2 rounded-full ${toneMap[tone]}`} />;
}

function MetricCard({ label, value, sublabel, tone }: { label: string; value: string; sublabel: string; tone: "green" | "amber" | "gold" | "red" }) {
  const toneMap = {
    green: "border-[#00ff88]/25 text-[#00ff88]",
    amber: "border-[#ffaa00]/25 text-[#ffaa00]",
    red: "border-[#ff4444]/25 text-[#ff4444]",
    gold: "border-[#C9A84C]/25 text-[#C9A84C]",
  };

  return (
    <div className={`rounded-[26px] border bg-[#141a15] p-4 ${toneMap[tone]}`}>
      <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">{label}</Text>
      <div className="mt-3 font-mono text-3xl font-bold tracking-tighter">{value}</div>
      <Text className="mt-2 text-[10px] uppercase tracking-[0.25em] text-[#6b7d6c]">{sublabel}</Text>
    </div>
  );
}

function classifyOrigin(raw: string) {
  const value = raw.toLowerCase();
  if (value.includes("indica") || value.includes("referral") || value.includes("recommend")) {
    return "Indicação";
  }
  if (value.includes("viral") || value.includes("post") || value.includes("reels") || value.includes("instagram") || value.includes("tiktok")) {
    return "Post viral";
  }
  if (value.includes("link") || value.includes("direct") || value.includes("utm") || value.includes("landing")) {
    return "Link direto";
  }
  if (value.includes("whatsapp")) {
    return "WhatsApp";
  }
  return "Outra origem";
}

function increment(map: Map<string, number>, key: string) {
  const normalized = normalize(key);
  if (!normalized) {
    return;
  }
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

async function loadAudienceData(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("onboarding_sessions").select("*").eq("org_id", orgId).order("created_at", { ascending: false }).limit(500);

  if (error || !data) {
    return {
      sessions: [] as OnboardingSessionRow[],
      archetypes: [] as RankedItem[],
      palettes: [] as RankedItem[],
      intentions: [] as RankedItem[],
      origins: [] as RankedItem[],
      total: 0,
      withPayload: 0,
    };
  }

  const sessions = data as OnboardingSessionRow[];
  const archetypes = new Map<string, number>();
  const palettes = new Map<string, number>();
  const intentions = new Map<string, number>();
  const origins = new Map<string, number>();

  for (const session of sessions) {
    const archetype = pickString(session, [
      ["archetype"],
      ["user_archetype"],
      ["profile"],
      ["intent", "archetype"],
      ["intent", "styleDirection"],
      ["styleDirection"],
      ["dominantStyle"],
    ]);
    const palette = pickString(session, [
      ["paletteFamily"],
      ["palette", "family"],
      ["palette", "name"],
      ["colors", "palette"],
      ["visual", "paletteFamily"],
    ]);
    const intention = pickString(session, [
      ["mainIntention"],
      ["intent", "imageGoal"],
      ["intent", "mainPain"],
      ["goal"],
      ["imageGoal"],
      ["main_intention"],
    ]);
    const origin = pickString(session, [
      ["source"],
      ["origin"],
      ["channel"],
      ["referrer"],
      ["acquisition"],
      ["traffic_source"],
      ["payload", "source"],
    ]);

    increment(archetypes, archetype || "Em descoberta");
    increment(palettes, palette || "Paleta aberta");
    increment(intentions, intention || "Sem intenção registrada");
    increment(origins, classifyOrigin(origin || "Outra origem"));
  }

  const sortByCount = (entries: Map<string, number>) =>
    [...entries.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));

  return {
    sessions,
    archetypes: sortByCount(archetypes),
    palettes: sortByCount(palettes),
    intentions: sortByCount(intentions),
    origins: sortByCount(origins),
    total: sessions.length,
    withPayload: sessions.filter((session) => Object.keys(asRecord(session.metadata)).length > 0 || Object.keys(asRecord(session.payload)).length > 0).length,
  };
}

export default async function MerchantAudiencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { org } = await fetchTenantBySlug(supabase, slug);
  if (!org || !isTenantActive(org)) {
    redirect("/merchant");
  }

  const appMeta = user.app_metadata as Record<string, string> | undefined;
  const userMeta = user.user_metadata as Record<string, string> | undefined;
  const userRole = appMeta?.role ?? userMeta?.role ?? "";
  const userOrgSlug = appMeta?.org_slug ?? userMeta?.org_slug ?? "";

  if (!isAgencyRole(userRole) && userOrgSlug !== slug) {
    redirect("/merchant");
  }

  const data = await loadAudienceData(org.id);
  const orgBase = `/org/${slug}`;
  const displayName = org.name || slug;
  const topArchetype = data.archetypes[0]?.label || "Sem dados";

  return (
    <div className="min-h-screen bg-[#080c0a] text-[#e8f0e9] flex">
      <aside className="w-72 flex-shrink-0 border-r border-[#1e2820] bg-[#0f1410] sticky top-0 h-screen p-5 flex flex-col gap-6">
        <div className="rounded-[28px] border border-[#1e2820] bg-[#141a15] p-4">
          <Text className="text-[9px] uppercase tracking-[0.35em] text-[#C9A84C]">Venus Engine</Text>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Heading as="h2" className="text-sm tracking-[0.2em] uppercase text-[#e8f0e9] truncate max-w-[160px]">
              {org.name ? org.name.slice(0, 16) + (org.name.length > 16 ? "..." : "") : (org.slug?.slice(0, 16) || slug)}
            </Heading>
            <StatusDot tone={org.status === "active" && !org.kill_switch ? "green" : org.status === "blocked" ? "red" : "amber"} />
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem href={`${orgBase}/dashboard`} icon={<LayoutGrid size={16} />} label="Executivo" />
          <NavItem href={`${orgBase}/performance`} icon={<Activity size={16} />} label="Performance" />
          <NavItem href={`${orgBase}/audience`} icon={<Users size={16} />} label="Audiência" active />
          <NavItem href={`${orgBase}/suggestions`} icon={<Sparkles size={16} />} label="Sugestões IA" />
          <NavItem href={`${orgBase}/catalog`} icon={<Package size={16} />} label="Catálogo" />
          <NavItem href={`${orgBase}/settings`} icon={<Settings size={16} />} label="Configurações" />
        </nav>

        <Link href={`${orgBase}/dashboard`} className="inline-flex items-center gap-2 rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-3 text-[10px] uppercase tracking-[0.28em] text-[#6b7d6c]">
          <ArrowLeft size={14} />
          Voltar ao dashboard
        </Link>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">Mission control / audiência</Text>
            <div className="font-mono text-[18px] font-medium tracking-tight text-[#e8f0e9]">AUDIÊNCIA — PERFIS E ORIGENS</div>
            <Text className="text-xs text-[#6b7d6c]">Leitura das sessões de onboarding por org_id.</Text>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#00ff88]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span>● TEMPO REAL</span>
            </div>
            <div className="rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-[#C9A84C]">
              {formatNumber(data.total)} sessões
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Arquétipos mais frequentes</Text>
                <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                  Leitura de perfil
                </Heading>
              </div>
              <Radar size={18} className="text-[#C9A84C]" />
            </div>

            <div className="mt-5 space-y-3">
              {data.archetypes.length > 0 ? (
                data.archetypes.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-[24px] border border-[#1e2820] bg-[#141a15] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium">{toTitleCase(item.label)}</div>
                        <div className="text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">Arquétipo</div>
                      </div>
                      <div className="font-mono text-2xl font-bold text-[#00ff88]">{formatNumber(item.count)}</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#0f1410]">
                      <div className="h-full rounded-full bg-[#00ff88]" style={{ width: `${Math.max(8, (item.count / Math.max(1, data.archetypes[0]?.count || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[#1e2820] bg-[#141a15] p-6 text-sm text-[#6b7d6c]">
                  Nenhum arquétipo encontrado nas sessões de onboarding.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Paletas identificadas</Text>
                  <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                    Preferências visuais
                  </Heading>
                </div>
                <Target size={18} className="text-[#ffaa00]" />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {data.palettes.length > 0 ? (
                  data.palettes.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-full border border-[#1e2820] bg-[#141a15] px-4 py-3">
                      <div className="text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">{item.label}</div>
                      <div className="mt-1 font-mono text-lg font-bold text-[#ffaa00]">{formatNumber(item.count)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-full border border-dashed border-[#1e2820] bg-[#141a15] px-4 py-3 text-sm text-[#6b7d6c]">
                    Nenhuma paleta detectada.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Intenções mais comuns</Text>
                  <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                    Necessidades percebidas
                  </Heading>
                </div>
                <Sparkles size={18} className="text-[#00ff88]" />
              </div>

              <div className="mt-5 space-y-3">
                {data.intentions.length > 0 ? (
                  data.intentions.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-[22px] border border-[#1e2820] bg-[#141a15] px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm">{item.label}</div>
                          <div className="text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">Intenção</div>
                        </div>
                        <div className="font-mono text-xl font-bold text-[#C9A84C]">{formatNumber(item.count)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[22px] border border-dashed border-[#1e2820] bg-[#141a15] p-5 text-sm text-[#6b7d6c]">
                    Nenhuma intenção capturada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[32px] border border-[#1e2820] bg-[#0f1410] p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Text className="text-[9px] uppercase tracking-[0.3em] text-[#6b7d6c]">Origem dos clientes</Text>
              <Heading as="h2" className="mt-1 text-xl uppercase tracking-tight">
                Link direto, post viral e indicação
              </Heading>
            </div>
            <Activity size={18} className="text-[#00ff88]" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.origins.length > 0 ? (
              data.origins.map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-[24px] border border-[#1e2820] bg-[#141a15] p-4">
                  <Text className="text-[9px] uppercase tracking-[0.25em] text-[#6b7d6c]">Origem</Text>
                  <div className="mt-2 text-lg font-medium">{item.label}</div>
                  <div className="mt-3 font-mono text-2xl font-bold text-[#e8f0e9]">{formatNumber(item.count)}</div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-[#1e2820] bg-[#141a15] p-5 text-sm text-[#6b7d6c]">
                Nenhuma origem disponível.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
