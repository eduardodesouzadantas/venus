import type { CSSProperties } from "react";

const dmSans = { className: "font-[family-name:var(--font-dm-sans)]" };
const spaceMono = { className: "font-[family-name:var(--font-space-mono)]" };

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
      <div className="mx-auto flex min-h-screen max-w-[1680px] items-center justify-center px-5">
        <div className="w-full max-w-lg rounded-[18px] border border-[var(--border)] bg-[var(--bg2)] p-6">
          <div className={`${spaceMono.className} text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]`}>
            Agency / control
          </div>
          <div className="mt-4 space-y-3">
            <div className="h-3 w-48 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-[var(--border)]" />
            <div className="h-3 w-3/5 animate-pulse rounded-full bg-[var(--border)]" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="h-20 animate-pulse rounded-[16px] border border-[var(--border)] bg-[var(--bg3)]" />
            <div className="h-20 animate-pulse rounded-[16px] border border-[var(--border)] bg-[var(--bg3)]" />
            <div className="h-20 animate-pulse rounded-[16px] border border-[var(--border)] bg-[var(--bg3)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
