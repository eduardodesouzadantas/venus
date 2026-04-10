"use client";

import { useState } from "react";

export function CopyTextButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--gold)] transition hover:border-[var(--gold)] hover:bg-[var(--gold)] hover:text-black"
    >
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}
