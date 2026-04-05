import { WhatsAppConversation, SmartReplySuggestion } from "@/types/whatsapp";

type ReplyTone = "direct" | "consultive" | "exploratory";

type LookSummaryItem = {
  id: string;
  name: string;
  intention: string;
  type: string;
  explanation: string;
  whenToWear: string;
};

/**
 * Heuristic-based Smart Replies Generator for Venus Engine.
 * It keeps the current angles, but adapts tone and references using the hydrated customer context.
 */
export function generateSmartReplies(conversation: WhatsAppConversation): SmartReplySuggestion[] {
  const lastMsg = conversation.messages[conversation.messages.length - 1];
  if (!lastMsg || lastMsg.sender !== "user") return [];

  const text = lastMsg.text.toLowerCase();
  const { intentScore, styleIdentity, name, imageGoal, lookSummary } = conversation.user;
  const firstName = name.split(" ")[0];
  const topLook = lookSummary?.[0];
  const secondLook = lookSummary?.[1];
  const tone = getReplyTone(intentScore);
  const goalLine = buildGoalLine(imageGoal, styleIdentity);
  const lookLine = buildLookLine(topLook, secondLook, styleIdentity);

  // 1. Detect Core Intent Signals
  const isDoubtfulPrice = ["quanto", "preco", "valor", "pagar", "desconto", "parcela", "custar", "esta"].some((w) => text.includes(w));
  const isDoubtfulFit = ["tamanho", "combina", "perfil", "cor", "veste", "corpo", "ombro", "cai"].some((w) => text.includes(w));
  const isReadyToClose =
    ["fechar", "comprar", "quero", "agora", "link", "fechamento", "manda", "pagina"].some((w) => text.includes(w)) || intentScore > 85;

  const suggestions: SmartReplySuggestion[] = [];

  // --- ANGLE 1: CLOSING ---
  if (isReadyToClose) {
    suggestions.push({
      id: "close-1",
      label: "Focar em Link",
      angle: "closing",
      text: buildClosingReply({
        tone,
        firstName,
        styleIdentity,
        goalLine,
        lookLine,
        direct: true,
      }),
      recommendedFor: "Alta Intencao",
      confidence: 0.95,
    });
  } else {
    suggestions.push({
      id: "close-2",
      label: "Decisao Estrategica",
      angle: "closing",
      text: buildClosingReply({
        tone,
        firstName,
        styleIdentity,
        goalLine,
        lookLine,
        direct: false,
      }),
      recommendedFor: "Avanco de Funil",
      confidence: 0.85,
    });
  }

  // --- ANGLE 2: OBJECTION ---
  if (isDoubtfulPrice) {
    suggestions.push({
      id: "obj-price",
      label: "Valor vs Oportunidade",
      angle: "price",
      text: buildPriceReply({
        tone,
        firstName,
        styleIdentity,
        goalLine,
        lookLine,
      }),
      recommendedFor: "Duvida de Preco",
      confidence: 0.9,
    });
  } else if (isDoubtfulFit) {
    suggestions.push({
      id: "obj-fit",
      label: "Ajuste e Caimento",
      angle: "fit",
      text: buildFitReply({
        tone,
        firstName,
        styleIdentity,
        goalLine,
        lookLine,
      }),
      recommendedFor: "Duvida de Tamanho",
      confidence: 0.92,
    });
  } else {
    suggestions.push({
      id: "obj-gen",
      label: "Reducao de Inseguranca",
      angle: "objection",
      text: buildObjectionReply({
        tone,
        firstName,
        styleIdentity,
        goalLine,
        lookLine,
      }),
      recommendedFor: "Hesitacao",
      confidence: 0.8,
    });
  }

  // --- ANGLE 3: DESIRE ---
  suggestions.push({
    id: intentScore > 60 ? "des-high" : "des-gen",
    label: intentScore > 60 ? "Impacto Imediato" : "Mudar a Percepcao",
    angle: "desire",
    text: buildDesireReply({
      tone,
      firstName,
      styleIdentity,
      goalLine,
      lookLine,
    }),
    recommendedFor: intentScore > 60 ? "Urgencia Estetica" : "Desejo",
    confidence: intentScore > 60 ? 0.88 : 0.75,
  });

  return suggestions;
}

function getReplyTone(intentScore: number): ReplyTone {
  if (intentScore >= 80) return "direct";
  if (intentScore >= 50) return "consultive";
  return "exploratory";
}

function buildGoalLine(imageGoal?: string, styleIdentity?: string) {
  if (imageGoal && styleIdentity) {
    return `${imageGoal.toLowerCase()} sem perder a leitura de ${styleIdentity.toLowerCase()}`;
  }

  if (imageGoal) return imageGoal.toLowerCase();
  if (styleIdentity) return styleIdentity.toLowerCase();
  return "a leitura certa para esse momento";
}

function buildLookLine(
  topLook?: LookSummaryItem,
  secondLook?: LookSummaryItem,
  styleIdentity?: string
) {
  if (topLook?.name) {
    const intention = topLook.intention ? ` para ${topLook.intention.toLowerCase()}` : "";
    return `o look ${topLook.name}${intention}`;
  }

  if (secondLook?.name) {
    return `a alternativa ${secondLook.name} como apoio para a linha de ${styleIdentity || "imagem"}`;
  }

  return styleIdentity ? `a linha de ${styleIdentity.toLowerCase()}` : "a linha sugerida";
}

function buildClosingReply(params: {
  tone: ReplyTone;
  firstName: string;
  styleIdentity?: string;
  goalLine: string;
  lookLine: string;
  direct: boolean;
}) {
  if (params.direct || params.tone === "direct") {
    return `Perfeito, ${params.firstName}. Pelo que vimos, ${params.lookLine} conversa muito com ${params.goalLine}. Vou liberar o link agora para seguir sem travar a decisao.`;
  }

  if (params.tone === "consultive") {
    return `Faz sentido, ${params.firstName}. O que eu selecionei antes já conversa com ${params.goalLine} e mantém coerencia com ${params.styleIdentity || "seu perfil"}. Se quiser, eu te envio o link da melhor opcao agora.`;
  }

  return `Boa leitura, ${params.firstName}. Antes de fechar, vale olhar ${params.lookLine} como uma forma mais segura de chegar em ${params.goalLine}. Se quiser, eu te passo o link e te guio no proximo passo.`;
}

function buildPriceReply(params: {
  tone: ReplyTone;
  firstName: string;
  styleIdentity?: string;
  goalLine: string;
  lookLine: string;
}) {
  if (params.tone === "direct") {
    return `Entendo seu foco no investimento, ${params.firstName}. Aqui a leitura não é só de produto: ${params.lookLine} foi escolhido para entregar ${params.goalLine}. Se fizer sentido, eu te mostro a melhor condição agora.`;
  }

  if (params.tone === "consultive") {
    return `Totalmente justo pensar no valor, ${params.firstName}. O ponto aqui é que ${params.lookLine} conversa com ${params.goalLine} e mantém a imagem consistente. Posso te explicar a melhor forma de avançar sem exagero?`;
  }

  return `Faz sentido olhar o investimento com calma, ${params.firstName}. A proposta de ${params.lookLine} foi pensada para preservar ${params.goalLine} e evitar uma compra desalinhada. Se quiser, eu detalho a melhor opcao.`;
}

function buildFitReply(params: {
  tone: ReplyTone;
  firstName: string;
  styleIdentity?: string;
  goalLine: string;
  lookLine: string;
}) {
  if (params.tone === "direct") {
    return `Sobre caimento, ${params.firstName}: ${params.lookLine} foi selecionado para sustentar ${params.goalLine} com mais precisao. Ele ajuda a organizar a leitura do corpo sem perder naturalidade.`;
  }

  if (params.tone === "consultive") {
    return `A duvida de caimento é normal, ${params.firstName}. O que eu trouxe antes já respeita ${params.goalLine} e conversa com a sua leitura de estilo. Se quiser, eu detalho como isso veste melhor no corpo.`;
  }

  return `Sem pressa, ${params.firstName}. Antes de seguir, faz sentido olhar com calma se ${params.lookLine} realmente sustenta ${params.goalLine}. Se quiser, eu te mostro a leitura completa.`;
}

function buildObjectionReply(params: {
  tone: ReplyTone;
  firstName: string;
  styleIdentity?: string;
  goalLine: string;
  lookLine: string;
}) {
  if (params.tone === "direct") {
    return `Entendo, ${params.firstName}. O ponto aqui é simples: ${params.lookLine} foi escolhido para reforcar ${params.goalLine}. Isso evita erro e deixa a imagem mais segura.`;
  }

  if (params.tone === "consultive") {
    return `Faz sentido ter cautela, ${params.firstName}. A leitura que eu trouxe antes respeita ${params.goalLine} e conversa com ${params.styleIdentity || "seu perfil"}. Se quiser, eu explico o raciocinio por trás.`;
  }

  return `Perfeito observar isso com calma, ${params.firstName}. O que eu selecionei tem a proposta de sustentar ${params.goalLine} sem te empurrar um catálogo generico. Posso te mostrar o porquê da escolha?`;
}

function buildDesireReply(params: {
  tone: ReplyTone;
  firstName: string;
  styleIdentity?: string;
  goalLine: string;
  lookLine: string;
}) {
  if (params.tone === "direct") {
    return `Olha a diferenca, ${params.firstName}: ${params.lookLine} já passa ${params.goalLine} com mais presença. Se quiser esse impacto, eu sigo com voce agora.`;
  }

  if (params.tone === "consultive") {
    return `Tem bastante potencial aqui, ${params.firstName}. ${params.lookLine} entrega uma leitura mais coerente com ${params.goalLine} e mantém o visual mais forte. Quer que eu detalhe a proposta?`;
  }

  return `Vale considerar com calma, ${params.firstName}. A proposta de ${params.lookLine} ajuda a construir ${params.goalLine} de um jeito mais natural. Se quiser, eu te mostro como isso se traduz na imagem.`;
}
