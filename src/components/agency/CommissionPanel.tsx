"use client";

import { useState } from "react";

interface CommissionPanelProps {
  orgId: string;
  commissionActive?: boolean;
  commissionRate?: number;
}

export function CommissionPanel({ orgId, commissionActive, commissionRate }: CommissionPanelProps) {
  const [active, setActive] = useState(commissionActive ?? false);
  const [rate, setRate] = useState(commissionRate ?? 5);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/admin/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_active: active, commission_rate: rate }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setActive((v) => !v)}
          className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            active ? "bg-[#D4AF37]" : "bg-white/10"
          }`}
          style={{ width: "3.25rem" }}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
              active ? "translate-x-[1.25rem]" : "translate-x-0"
            }`}
          />
        </button>
        <span className="font-mono text-sm uppercase tracking-[0.3em] text-white/70">
          {active ? "Comissão ativada" : "Comissão desativada"}
        </span>
      </div>

      {active && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">
              Taxa de comissão
            </span>
            <span className="font-mono text-lg font-bold text-[#D4AF37]">{rate}%</span>
          </div>
          <input
            type="range"
            min={3}
            max={8}
            step={0.5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="w-full accent-[#D4AF37]"
          />
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
            <span>3%</span>
            <span>8%</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="h-10 rounded-full bg-[#D4AF37] px-6 font-mono text-[9px] font-bold uppercase tracking-[0.35em] text-black transition-opacity disabled:opacity-50"
      >
        {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar configuração"}
      </button>
    </div>
  );
}
