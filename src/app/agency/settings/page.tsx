export const dynamic = "force-dynamic";

const publicBaseUrl = "https://venus-engine.vercel.app";
const webhookUrl = `${publicBaseUrl}/api/meta/whatsapp/webhook`;

const settings = [
  {
    label: "Provisionamento",
    value: "Manual assistido",
    tone: "green",
  },
  {
    label: "Alertas financeiros",
    value: "Ativo",
    tone: "green",
  },
  {
    label: "Kill switch global",
    value: "Desarmado",
    tone: "amber",
  },
  {
    label: "Auditoria",
    value: "Retenção 90d",
    tone: "green",
  },
];

function toneClass(tone: string) {
  if (tone === "amber") return "bg-[var(--amber)] shadow-[0_0_14px_var(--amber)]";
  if (tone === "red") return "bg-[var(--red)] shadow-[0_0_14px_var(--red)]";
  return "bg-[var(--green)] shadow-[0_0_14px_var(--green)]";
}

const preferenceFields = [
  { label: "Nome público", value: "InovaCortex" },
  { label: "Domínio padrão", value: "venus-engine.vercel.app" },
  { label: "E-mail de suporte", value: "contato@inovacortex.com" },
  { label: "Webhook operacional", value: webhookUrl },
];

export default function AgencySettingsPage() {
  return (
    <div className="min-h-screen px-5 py-6 lg:px-8">
      <header className="border-b border-[var(--border)] bg-[var(--bg2)] px-5 py-5">
        <div className="font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[2px] text-[var(--muted)]">
          CONTROL PLANE
        </div>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-space-mono)] text-2xl font-bold uppercase tracking-[-0.04em] text-[var(--text)]">
              Configurações
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Parâmetros operacionais da agência, segurança e automações do Venus Engine.
            </p>
          </div>
          <div className="flex items-center gap-2 font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[1px] text-[var(--green)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--green)]" />
            CONFIG ONLINE
          </div>
        </div>
      </header>

      <section className="mt-1 grid gap-[1px] bg-[var(--border)] md:grid-cols-2 xl:grid-cols-4">
        {settings.map((item) => (
          <div key={item.label} className="bg-[var(--bg2)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="font-[family-name:var(--font-space-mono)] text-[9px] uppercase tracking-[1px] text-[var(--muted)]">
                {item.label}
              </div>
              <span className={`h-2 w-2 rounded-full ${toneClass(item.tone)}`} />
            </div>
            <div className="mt-3 font-[family-name:var(--font-space-mono)] text-lg font-bold text-[var(--text)]">
              {item.value}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="border border-[var(--border)] bg-[var(--bg2)] p-5">
          <div className="font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[2px] text-[var(--gold)]">
            PREFERÊNCIAS DA AGÊNCIA
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              { label: "Nome público", value: "InovaCortex" },
              { label: "Domínio padrão", value: "venus-engine.vercel.app" },
              { label: "E-mail de suporte", value: "contato@inovacortex.com" },
              { label: "Webhook operacional", value: webhookUrl },
            ].map((item) => (
              <label key={item.label} className="block">
                <span className="font-[family-name:var(--font-space-mono)] text-[9px] uppercase tracking-[1px] text-[var(--muted)]">
                  {item.label}
                </span>
                <input
                  className="mt-2 w-full border border-[var(--border)] bg-[var(--bg3)] px-3 py-3 font-[family-name:var(--font-space-mono)] text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                  defaultValue={item.value}
                  readOnly
                />
              </label>
            ))}
          </div>
          <button className="mt-5 border border-[var(--gold)] bg-[rgba(201,168,76,0.12)] px-4 py-3 font-[family-name:var(--font-space-mono)] text-[10px] font-bold uppercase tracking-[1.5px] text-[var(--gold)]">
            SALVAR CONFIGURAÇÕES
          </button>
        </div>

        <div className="border border-[var(--border)] bg-[var(--bg2)] p-5">
          <div className="font-[family-name:var(--font-space-mono)] text-[10px] uppercase tracking-[2px] text-[var(--gold)]">
            Segurança
          </div>
          <div className="mt-5 space-y-3">
            {["Logs de auditoria ativos", "Acesso agency restrito", "Rotação de chaves pendente"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 border border-[var(--border)] bg-[var(--bg3)] p-3">
                <span className={`h-2 w-2 rounded-full ${index === 2 ? toneClass("amber") : toneClass("green")}`} />
                <span className="text-sm text-[var(--text)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
