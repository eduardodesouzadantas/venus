"use client";

import { useState, useTransition } from "react";
import { VenusButton } from "@/components/ui/VenusButton";
import { Text } from "@/components/ui/Text";

export function CommissionControls({
  orgId,
  initialActive,
  initialRate,
}: {
  orgId: string;
  initialActive: boolean;
  initialRate: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [active, setActive] = useState(initialActive);
  const [rate, setRate] = useState(String(initialRate || 3));
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = () => {
    startTransition(async () => {
      setStatus(null);

      try {
        const response = await fetch(`/api/agency/orgs/${orgId}/commission`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            commissionActive: active,
            commissionRate: Number(rate) || 0,
          }),
        });

        const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; org?: { commission_active?: boolean; commission_rate?: number } } | null;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Nao foi possivel salvar a comissão");
        }

        setActive(Boolean(payload.org?.commission_active));
        setRate(String(payload.org?.commission_rate ?? rate));
        setStatus("Comissão atualizada");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Falha ao salvar comissão");
      }
    });
  };

  return (
    <div className="rounded-[28px] border border-white/5 bg-white/[0.03] p-5">
      <Text className="text-[9px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Comissão por vendas</Text>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Ativa</span>
          <button
            type="button"
            onClick={() => setActive((value) => !value)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
              active ? "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-white" : "border-white/10 bg-black/20 text-white/55"
            }`}
          >
            {active ? "Ligada" : "Desligada"}
          </button>
        </label>
        <label className="flex w-full flex-col gap-2 sm:max-w-[10rem]">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Percentual</span>
          <input
            type="number"
            min={3}
            max={8}
            step={0.1}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]/30"
          />
        </label>
        <VenusButton
          type="button"
          onClick={handleSave}
          disabled={isPending}
          variant="solid"
          className="h-12 rounded-full bg-[#D4AF37] px-5 text-[10px] font-bold uppercase tracking-[0.3em] text-black"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </VenusButton>
      </div>
      <Text className="mt-3 text-[11px] text-white/40">Percentual recomendado entre 3% e 8%.</Text>
      {status ? <Text className="mt-2 text-[11px] text-white/55">{status}</Text> : null}
    </div>
  );
}
