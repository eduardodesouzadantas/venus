"use client";

import { use, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Share2 } from "lucide-react";

import { Heading } from "@/components/ui/Heading";
import { Text } from "@/components/ui/Text";
import { VenusButton } from "@/components/ui/VenusButton";
import { rewardTypeLabel, rewardTypeNeedsValue, type MerchantRewardRecord, type MerchantRewardType, MERCHANT_REWARD_TYPES } from "@/lib/merchant/rewards";

type RewardsResponse =
  | {
    ok: true;
    org: {
      id: string;
      slug: string;
      name: string;
    };
    rewards: MerchantRewardRecord[];
  }
  | {
    error?: string;
  };

type RewardMutationResponse =
  | {
    ok: true;
    reward: MerchantRewardRecord;
  }
  | {
    error?: string;
  };

const REWARD_OPTIONS: Array<{ value: MerchantRewardType; description: string }> = MERCHANT_REWARD_TYPES.map((type) => ({
  value: type,
  description: rewardTypeLabel(type),
}));

export default function MerchantRewardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const orgBase = `/org/${slug}`;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orgName, setOrgName] = useState(slug);
  const [rewards, setRewards] = useState<MerchantRewardRecord[]>([]);
  const [type, setType] = useState<MerchantRewardType>("discount_percent");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRewards() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/org/${slug}/rewards`, {
          headers: { "Cache-Control": "no-store" },
        });
        const payload = (await response.json().catch(() => null)) as RewardsResponse | null;

        if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
          throw new Error(payload && "error" in payload && payload.error ? payload.error : "Nao foi possivel carregar as recompensas");
        }

        if (cancelled) return;

        setOrgName(payload.org.name || slug);
        setRewards(payload.rewards || []);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar recompensas");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRewards();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const activeRewards = useMemo(() => rewards.filter((reward) => reward.active), [rewards]);
  const inactiveRewards = useMemo(() => rewards.filter((reward) => !reward.active), [rewards]);

  const clearForm = () => {
    setLabel("");
    setValue("");
    setExpiresAt("");
    setType("discount_percent");
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        type,
        label: label.trim(),
        expires_at: expiresAt || null,
      };

      if (rewardTypeNeedsValue(type)) {
        payload.value = value.trim();
      }

      const response = await fetch(`/api/org/${slug}/rewards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as RewardMutationResponse | null;

      if (!response.ok || !body || !("ok" in body) || !body.ok) {
        throw new Error(body && "error" in body && body.error ? body.error : "Nao foi possivel criar a recompensa");
      }

      setRewards((current) => [body.reward, ...current]);
      clearForm();
      setSuccess("Recompensa criada com sucesso");
      window.setTimeout(() => setSuccess(null), 1800);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Falha ao criar recompensa");
    } finally {
      setSaving(false);
    }
  };

  const toggleReward = async (reward: MerchantRewardRecord) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/org/${slug}/rewards`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          reward_id: reward.id,
          active: !reward.active,
        }),
      });

      const body = (await response.json().catch(() => null)) as RewardMutationResponse | null;
      if (!response.ok || !body || !("ok" in body) || !body.ok) {
        throw new Error(body && "error" in body && body.error ? body.error : "Nao foi possivel atualizar a recompensa");
      }

      setRewards((current) => current.map((item) => (item.id === reward.id ? body.reward : item)));
      setSuccess(reward.active ? "Recompensa desativada" : "Recompensa ativada");
      window.setTimeout(() => setSuccess(null), 1800);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Falha ao atualizar recompensa");
    } finally {
      setSaving(false);
    }
  };

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
          <NavItem href={`${orgBase}/dashboard`} icon={<ArrowLeft size={16} />} label="Dashboard" />
          <NavItem href={`${orgBase}/settings`} icon={<Share2 size={16} />} label="Identidade" />
          <NavItem href={`${orgBase}/rewards`} icon={<Share2 size={16} />} label="Recompensas" active />
        </nav>
      </aside>

      <main className="flex-1 p-8 md:p-12 overflow-y-auto no-scrollbar">
        <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between mb-10">
          <div className="space-y-2">
            <Text className="text-[10px] uppercase font-bold tracking-[0.4em] text-[#C9A84C]">
              {orgName}
            </Text>
            <Heading as="h1" className="text-3xl md:text-4xl tracking-tighter uppercase leading-none">
              Recompensas do loop viral
            </Heading>
            <Text className="text-sm text-white/50 max-w-2xl">
              Crie ofertas para o cliente postar, confirmar a publicacao e desbloquear beneficios de volta para a loja.
            </Text>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`${orgBase}/settings`}>
              <VenusButton variant="outline" className="h-12 px-5 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium border-white/10">
                Abrir configuracoes
              </VenusButton>
            </Link>
            <VenusButton
              onClick={handleCreate}
              disabled={loading || saving || !label.trim() || (rewardTypeNeedsValue(type) && !value.trim())}
              variant="solid"
              className="h-12 px-6 rounded-full text-[10px] uppercase tracking-[0.08em] font-medium bg-[#C9A84C] text-black"
            >
              {saving ? "Salvando..." : "Criar recompensa"}
            </VenusButton>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-3xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-100">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <Panel
              title="Nova recompensa"
              description="Escolha o tipo, o texto da recompensa e a validade. Desconto percentual e fixo usam valor numerico."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {REWARD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={`rounded-[28px] border px-4 py-4 text-left transition-colors ${type === option.value
                        ? "border-[#C9A84C]/30 bg-[#C9A84C]/10 text-white"
                        : "border-white/10 bg-black/30 text-white/80 hover:bg-white/5"
                      }`}
                  >
                    <div className="text-sm font-medium">{rewardTypeLabel(option.value)}</div>
                    <div className="mt-1 text-[11px] text-white/45">{option.description}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-4">
                <label className="space-y-2">
                  <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">Label da recompensa</span>
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    className="h-14 w-full rounded-3xl border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                    placeholder="Ex: 10% na proxima compra"
                  />
                </label>

                {rewardTypeNeedsValue(type) ? (
                  <label className="space-y-2">
                    <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">Valor</span>
                    <input
                      type="number"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      className="h-14 w-full rounded-3xl border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                      placeholder={type === "discount_percent" ? "10" : "50"}
                    />
                  </label>
                ) : null}

                <label className="space-y-2">
                  <span className="ml-1 text-[10px] uppercase font-bold tracking-[0.3em] text-white/35">Validade</span>
                  <input
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className="h-14 w-full rounded-3xl border border-white/10 bg-white/5 px-5 text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/40"
                  />
                </label>
              </div>
            </Panel>

            <Panel title="Recompensas ativas" description="Estas recompensas ficam disponiveis para o cliente no fluxo do share.">
              <div className="space-y-3">
                {activeRewards.length > 0 ? (
                  activeRewards.map((reward) => <RewardCard key={reward.id} reward={reward} onToggle={toggleReward} />)
                ) : (
                  <EmptyState title="Sem recompensas ativas" description="Crie a primeira recompensa para liberar o loop viral." />
                )}
              </div>
            </Panel>
          </section>

          <aside className="space-y-6">
            <Panel title="Recompensas inativas" description="Use para pausar uma oferta sem apagar o historico.">
              <div className="space-y-3">
                {inactiveRewards.length > 0 ? (
                  inactiveRewards.map((reward) => <RewardCard key={reward.id} reward={reward} onToggle={toggleReward} />)
                ) : (
                  <EmptyState title="Sem recompensas inativas" description="Quando voce pausar uma oferta, ela aparece aqui." />
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </main>
    </div>
  );
}

function RewardCard({
  reward,
  onToggle,
}: {
  reward: MerchantRewardRecord;
  onToggle: (reward: MerchantRewardRecord) => Promise<void>;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#C9A84C]/20 bg-[#C9A84C]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#C9A84C]">
              {rewardTypeLabel(reward.type)}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${reward.active
                  ? "border-green-500/20 bg-green-500/10 text-green-300"
                  : "border-white/10 bg-white/5 text-white/45"
                }`}
            >
              {reward.active ? "Ativa" : "Inativa"}
            </span>
          </div>
          <Heading as="h3" className="text-lg tracking-tight">
            {reward.label}
          </Heading>
          <Text className="text-xs text-white/45">
            {reward.expires_at ? `Validade: ${new Date(reward.expires_at).toLocaleDateString("pt-BR")}` : "Sem validade definida"}
          </Text>
          {reward.value !== null ? (
            <Text className="text-xs text-white/45">Valor: {reward.value}</Text>
          ) : null}
        </div>

        <VenusButton
          type="button"
          onClick={() => void onToggle(reward)}
          variant="outline"
          className="h-11 px-4 rounded-full border-white/10 text-[10px] uppercase tracking-[0.08em] font-medium"
        >
          {reward.active ? "Desativar" : "Ativar"}
        </VenusButton>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-[40px] border border-white/5 bg-white/[0.03] p-5 md:p-7">
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

function NavItem({ href, icon, label, active = false }: { href: string; icon: ReactNode; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all ${active ? "bg-white text-black shadow-2xl" : "text-white/40 hover:bg-white/5 hover:text-white"
        }`}
    >
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
    </Link>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/10 bg-black/20 p-4 text-sm text-white/50">
      <div className="flex items-center gap-2 text-white/80">
        <Check size={14} className="text-[#C9A84C]" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="mt-1 text-xs text-white/45">{description}</div>
    </div>
  );
}
