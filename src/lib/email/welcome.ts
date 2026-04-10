import "server-only";

export interface MerchantWelcomeEmailInput {
  to: string;
  storeName: string;
  slug: string;
  email: string;
  password: string;
  planLabel: string;
  loginUrl: string;
}

export interface MerchantWelcomeEmailResult {
  sent: boolean;
  provider: "resend" | "none";
  message: string;
}

function buildEmailText(input: MerchantWelcomeEmailInput) {
  return [
    `Bem-vindo a ${input.storeName}`,
    "",
    `Sua loja ja esta ativa no Venus Engine.`,
    `Acesso: ${input.loginUrl}`,
    `Slug da loja: ${input.slug}`,
    `Email: ${input.email}`,
    `Senha inicial: ${input.password}`,
    `Plano: ${input.planLabel}`,
    "",
    "Se precisar, entre em contato com a agencia responsavel.",
  ].join("\n");
}

function buildEmailHtml(input: MerchantWelcomeEmailInput) {
  const loginUrl = input.loginUrl;
  return `
    <div style="font-family: Inter, Arial, sans-serif; background:#0b0b0b; color:#f5f5f5; padding:32px">
      <div style="max-width:640px; margin:0 auto; background:#111; border:1px solid rgba(255,255,255,0.08); border-radius:24px; padding:28px">
        <p style="margin:0 0 12px; color:#D4AF37; text-transform:uppercase; letter-spacing:.18em; font-size:12px">Venus Engine</p>
        <h1 style="margin:0 0 16px; font-size:30px; line-height:1.1">Sua loja ${input.storeName} ja pode entrar</h1>
        <p style="margin:0 0 18px; color:rgba(255,255,255,0.72); font-size:15px; line-height:1.6">
          O acesso da loja foi criado pela agencia. Use as credenciais abaixo para entrar no painel B2B.
        </p>
        <div style="border:1px solid rgba(212,175,55,0.22); background:rgba(212,175,55,0.08); border-radius:20px; padding:18px; margin:0 0 20px">
          <p style="margin:0 0 8px; color:#D4AF37; font-size:12px; letter-spacing:.14em; text-transform:uppercase">Credenciais</p>
          <p style="margin:0 0 6px"><strong>Email:</strong> ${input.email}</p>
          <p style="margin:0 0 6px"><strong>Senha inicial:</strong> ${input.password}</p>
          <p style="margin:0"><strong>Plano:</strong> ${input.planLabel}</p>
        </div>
        <a href="${loginUrl}" style="display:inline-block; background:#D4AF37; color:#111; text-decoration:none; padding:14px 22px; border-radius:999px; font-weight:700">
          Entrar no painel
        </a>
        <p style="margin:18px 0 0; color:rgba(255,255,255,0.55); font-size:12px; line-height:1.6">
          Slug da loja: ${input.slug}
        </p>
      </div>
    </div>
  `;
}

export async function sendMerchantWelcomeEmail(
  input: MerchantWelcomeEmailInput
): Promise<MerchantWelcomeEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return {
      sent: false,
      provider: "none",
      message: "Resend not configured",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Bem-vindo a ${input.storeName}`,
      text: buildEmailText(input),
      html: buildEmailHtml(input),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details ? `Resend error: ${details}` : `Resend error: ${response.status}`);
  }

  return {
    sent: true,
    provider: "resend",
    message: "Email sent",
  };
}
