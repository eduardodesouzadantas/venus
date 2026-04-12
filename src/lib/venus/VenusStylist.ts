import OpenAI from "openai";

import type { VenusContext, VenusIntent } from "./types";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function normalize(value: string) {
  return value.trim();
}

function normalizeLoose(value: string) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type SizeBand = "PP" | "P" | "M" | "G" | "GG";

function inferBodySizeBand(value: string): SizeBand | null {
  const normalized = normalizeLoose(value);
  if (!normalized) return null;
  if (normalized.includes("oversized")) return "GG";
  if (normalized.includes("relaxed")) return "G";
  if (normalized.includes("slim")) return "M";
  if (normalized.includes("justissimo") || normalized.includes("justo")) return "P";
  return null;
}

function sizeBandRank(value: SizeBand): number {
  return {
    PP: 0,
    P: 1,
    M: 2,
    G: 3,
    GG: 4,
  }[value];
}

function extractRequestedSize(message: string): SizeBand | null {
  const normalized = ` ${normalizeLoose(message).toUpperCase()} `;
  const match = normalized.match(/\b(PP|GG|G|M|P)\b/);
  if (!match) return null;
  return match[1] as SizeBand;
}

function isSizeDiscussion(message: string): boolean {
  const normalized = normalizeLoose(message);
  return /\b(tamanho|caimento|veste|veste bem|numera|numeração|numeracao|p|m|g|gg|pp)\b/.test(normalized);
}

function buildPreventiveSizeAlert(ctx: VenusContext, message: string): string | null {
  if (!isSizeDiscussion(message)) return null;

  const requestedSize = extractRequestedSize(message);
  const bodyBand = inferBodySizeBand(ctx.fit);
  if (!requestedSize || !bodyBand) return null;

  const requestedRank = sizeBandRank(requestedSize);
  const bodyRank = sizeBandRank(bodyBand);

  if (requestedRank >= bodyRank) return null;

  const productSize = normalizeLoose(ctx.productSize);
  const productHint = productSize ? `A peça em leitura está em ${ctx.productSize}. ` : "";

  return [
    `Eu prefiro te proteger de uma troca errada: pelo caimento que já li em você, ${ctx.fit.toLowerCase()} tende a pedir algo mais próximo de ${bodyBand}.`,
    `${productHint}${requestedSize} pode apertar, quebrar a linha ou reduzir conforto.`,
    "Se quiser, eu sigo com a faixa mais segura e te explico o porquê de forma objetiva.",
  ].join(" ");
}

function buildStateInstruction(state: VenusIntent): string {
  const instructions: Record<VenusIntent, string> = {
    primeira_mensagem: `primeira_mensagem: abra reconhecendo o perfil.`,
    curiosidade: `curiosidade: conecte a peça ao arquétipo do cliente.`,
    interesse: `interesse: reduza fricção e ofereça o próximo passo.`,
    objecao: `objecao: valide a hesitação e reposicione a peça.`,
    preco: `preco: nunca desconte; ofereça alternativa ou contexto de valor.`,
    compra: `compra: facilite o fechamento e celebre em uma linha.`,
    humano: `humano: transfira com contexto completo para a equipe.`,
    sumiu: `sumiu: reengaje com contexto relevante e sem pressão.`,
  };

  return instructions[state];
}

function buildHistorySummary(ctx: VenusContext) {
  const recent = ctx.history.slice(-6);
  if (!recent.length) {
    return "sem histórico relevante";
  }

  return recent
    .map((entry) => {
      const role = normalize(entry.sender).toLowerCase() === "venus" ? "venus" : "cliente";
      return `${role}: ${entry.text}`;
    })
    .join(" | ");
}

function buildSystemPrompt(ctx: VenusContext): string {
  return `Você é Venus, personal stylist da ${ctx.orgName}.
Tem 15 anos de experiência em consultoria de imagem, visagismo e colorimetria.

CONTEXTO DO CLIENTE:
- Nome: ${ctx.clientName}
- Arquétipo: ${ctx.archetype}
- Paleta: ${ctx.palette}
- Fit: ${ctx.fit}
- Intenção: ${ctx.intention}
- Peça de interesse: ${ctx.productName || ctx.look || "não definida"}${ctx.productSize ? ` — Tamanho ${ctx.productSize}` : ""}
- Estoque: ${ctx.stockSummary}
- Histórico: ${buildHistorySummary(ctx)}
- Catálogo: ${ctx.catalogSummary || "sem catálogo relevante"}
- Guarda-roupa: ${ctx.wardrobeSummary || "sem itens registrados"}

COMO FALAR:
- Fale como consultora de imagem, não como formulário
- Quando houver leitura visual, trate-a como sinal principal e proponha perguntas a partir dela
- Linguagem elegante, direta, emocional — nunca robótica
- Máximo 3 linhas por mensagem no WhatsApp
- Nunca diga: certamente, claro!, com prazer, posso te ajudar?
- Máximo 1 emoji por mensagem
- Baseie cada resposta no arquétipo e contexto do cliente
- Se houver sinal de tamanho incompatível, faça um alerta preventivo e educacional antes de prosseguir

ESTADO DETECTADO: ${buildStateInstruction(ctx.state)}

Estados possíveis e como agir:
- primeira_mensagem: abra reconhecendo o perfil
- curiosidade: conecte a peça ao arquétipo
- interesse: reduza fricção, ofereça próximo passo
- objecao: valide e reposicione
- preco: nunca desconte, ofereça alternativa
- compra: facilite, celebre, plante próxima semente
- humano: transfira com contexto completo
- sumiu: reengajamento com contexto relevante`;
}

function buildHistoryMessages(ctx: VenusContext, message: string) {
  const normalizedCurrent = normalize(message).toLowerCase();
  const history = [...ctx.history];

  if (history.length > 0) {
    const last = history[history.length - 1];
    const lastText = normalize(last.text).toLowerCase();
    if (last.sender !== "venus" && lastText === normalizedCurrent) {
      history.pop();
    }
  }

  return history.slice(-8).map((entry) => ({
    role: (normalize(entry.sender).toLowerCase() === "venus" ? "assistant" : "user") as "user" | "assistant",
    content: entry.text,
  }));
}

export async function generateReply(context: VenusContext, message: string): Promise<string> {
  if (!openai) {
    return "";
  }

  const preventiveAlert = buildPreventiveSizeAlert(context, message);
  if (preventiveAlert) {
    return preventiveAlert;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    temperature: 0.75,
    messages: [
      { role: "system", content: buildSystemPrompt(context) },
      ...buildHistoryMessages(context, message),
      {
        role: "user",
        content: `MENSAGEM ATUAL DO CLIENTE: ${message}`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export const generateVenusReply = generateReply;
