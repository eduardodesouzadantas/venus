import type { CSSProperties, ReactNode } from "react";

import { AgencySidebar } from "@/components/agency/AgencySidebar";

const dmSans = { className: "font-[family-name:var(--font-dm-sans)]", variable: "--font-dm-sans" };
const spaceMono = { className: "font-[family-name:var(--font-space-mono)]", variable: "--font-space-mono" };
const fontVars: CSSProperties & Record<string, string> = {
  ["--font-dm-sans"]: "DM Sans, ui-sans-serif, system-ui, sans-serif",
  ["--font-space-mono"]: '"Space Mono", ui-monospace, SFMono-Regular, monospace',
};

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

export default function AgencyLayout({ children }: { children: ReactNode }) {
  return (
    <section
      className={`${dmSans.variable} ${spaceMono.variable} ${dmSans.className} min-h-screen bg-[var(--bg)] text-[var(--text)]`}
      style={{ ...themeVars, ...fontVars }}
    >
      <div className="min-h-screen bg-[radial-gradient(circle_at_80%_0%,rgba(201,168,76,0.12),transparent_28%),linear-gradient(135deg,var(--bg),#050705)] lg:flex">
        <AgencySidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </section>
  );
}
