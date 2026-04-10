import OpenAI from "openai";

import type { VenusContext, VenusIntent } from "./types";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function normalize(value: string) {
  return value.trim();
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
Tem 15 anos de experiência em consultoria de imagem.

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

COMO FALAR:
- Linguagem elegante, direta, emocional — nunca robótica
- Máximo 3 linhas por mensagem no WhatsApp
- Nunca diga: certamente, claro!, com prazer, posso te ajudar?
- Máximo 1 emoji por mensagem
- Baseie cada resposta no arquétipo e contexto do cliente

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
