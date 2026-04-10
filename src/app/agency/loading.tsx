import type { CSSProperties } from "react";
import { DM_Sans, Space_Mono } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

const themeVars = {
  ["--gold"]: "#C9A84C",
  ["--green"]: "#00ff88",
  ["--red"]: "#ff4444",
  ["--amber"]: "#ffaa00",
  ["--bg"]: "#080c0a",
  ["--bg2"]: "#0f1410",
  ["--bg3"]: "#141a15",
  ["--border"]: "#1e2820",
  ["--text"]: "#e8f0e9",
  ["--muted"]: "#6b7d6c",
} as CSSProperties & Record<string, string>;

export default function Loading() {
  return (
    <div className={`${dmSans.className} min-h-screen bg-[var(--bg)] text-[var(--text)]`} style={themeVars}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] items-center justify-center px-5 lg:px-8">
        <div className="w-full max-w-md rounded-[16px] border border-[var(--border)] bg-[var(--bg2)] p-6">
          <div className="space-y-1">
            <div className={`${spaceMono.className} text-[11px] uppercase tracking-[2px] text-[var(--gold)]`}>
              INOVACORTEX
            </div>
            <div className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--muted)]`}>
              CONTROL PLANE
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-3 w-3/5 animate-pulse rounded-full bg-[var(--border)]" />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--green)] animate-pulse" />
            <span className={`${spaceMono.className} text-[10px] uppercase tracking-[1px] text-[var(--green)]`}>
              CARREGANDO PAINEL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
