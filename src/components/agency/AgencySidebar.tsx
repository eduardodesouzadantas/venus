"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/agency", code: "OVR" },
  { label: "Lojas", href: "/agency/merchants", code: "ORG" },
  { label: "Nova loja", href: "/agency/merchants/new", code: "NEW" },
  { label: "Financeiro", href: "/agency/billing", code: "FIN" },
  { label: "Configurações", href: "/agency/settings", code: "CFG" },
];

function isActive(pathname: string, href: string) {
  if (href === "/agency") {
    return pathname === href;
  }

  if (href === "/agency/merchants") {
    return pathname === href || (pathname.startsWith(`${href}/`) && pathname !== "/agency/merchants/new");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgencySidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-[var(--border)] bg-[var(--bg2)] lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--border)] px-5 py-5">
          <Link href="/agency" className="block">
            <div className="font-[family-name:var(--font-space-mono)] text-[11px] font-bold uppercase tracking-[2px] text-[var(--gold)]">
              INOVACORTEX
            </div>
            <div className="mt-1 font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[1px] text-[var(--muted)]">
              AGENCY CONTROL
            </div>
          </Link>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-1 lg:flex-col lg:overflow-visible">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group relative flex min-w-fit items-center gap-3 border px-4 py-3 transition",
                  "font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[1.5px]",
                  active
                    ? "border-[var(--gold)] bg-[rgba(201,168,76,0.12)] text-[var(--gold)] shadow-[inset_3px_0_0_var(--gold)]"
                    : "border-[var(--border)] bg-[var(--bg3)] text-[var(--muted)] hover:border-[var(--gold)]/60 hover:text-[var(--text)]",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-9 items-center justify-center border text-[9px]",
                    active
                      ? "border-[var(--gold)] bg-[rgba(201,168,76,0.16)] text-[var(--gold)]"
                      : "border-[var(--border)] bg-[var(--bg)] text-[var(--muted)] group-hover:border-[var(--gold)]/50",
                  ].join(" ")}
                >
                  {item.code}
                </span>
                <span>{item.label}</span>
                {active ? <span className="ml-auto hidden h-2 w-2 rounded-full bg-[var(--green)] shadow-[0_0_14px_var(--green)] lg:block" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-[var(--border)] p-5 lg:block">
          <div className="flex items-center gap-2 font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[1px] text-[var(--green)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--green)]" />
            SISTEMA ONLINE
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            Painel operacional da agência para lojas, cobrança e configurações.
          </p>
        </div>
      </div>
    </aside>
  );
}
