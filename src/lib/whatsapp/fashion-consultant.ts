import type {
  WhatsAppConversation,
  WhatsAppLookItemContext,
  WhatsAppLookSummary,
} from "@/types/whatsapp";

export type FashionReplyTone = "direct" | "consultive" | "exploratory";
export type FashionReplyAngle = "closing" | "price" | "fit" | "objection" | "desire" | "follow_up";

export interface FashionConsultationSnapshot {
  firstName: string;
  styleIdentity: string;
  imageGoal: string;
  paletteFamily: string;
  fit: string;
  metal: string;
  intentScore: number;
  tryOnCount: number;
  viewedProductsCount: number;
  topLookName: string;
  topLookIntention: string;
  topLookType: string;
  topLookExplanation: string;
  topLookWhenToWear: string;
  secondLookName: string;
  topLookRole: string;
  topLookDirection: string;
  topLookVisualWeight: string;
  topLookFormality: string;
  topLookBodyEffect: string;
  topLookFaceEffect: string;
  topLookAuthorityRationale: string;
  topLookConversionCopy: string;
  topLookUseCases: string[];
  topLookItemName: string;
  topLookItemSummary: string;
  topLook: WhatsAppLookSummary | null;
  secondLook: WhatsAppLookSummary | null;
}

export function buildFashionConsultationSnapshot(conversation: WhatsAppConversation): FashionConsultationSnapshot {
  const firstName = splitFirstName(conversation.user.name);
  const topLook = conversation.user.lookSummary?.[0] || null;
  const secondLook = conversation.user.lookSummary?.[1] || null;
  const topLookItem = pickLookItem(topLook);

  return {
    firstName,
    styleIdentity: normalizeLabel(conversation.user.styleIdentity, "seu perfil"),
    imageGoal: normalizeLabel(conversation.user.imageGoal, "a imagem que você quer transmitir"),
    paletteFamily: normalizeLabel(conversation.user.paletteFamily, ""),
    fit: normalizeLabel(conversation.user.fit, ""),
    metal: normalizeLabel(conversation.user.metal, ""),
    intentScore: conversation.user.intentScore ?? 0,
    tryOnCount: conversation.user.tryOnCount ?? 0,
    viewedProductsCount: conversation.user.viewedProducts?.length ?? 0,
    topLookName: normalizeLabel(topLook?.name, ""),
    topLookIntention: normalizeLabel(topLook?.intention, ""),
    topLookType: normalizeLabel(topLook?.type, ""),
    topLookExplanation: normalizeLabel(topLook?.explanation, ""),
    topLookWhenToWear: normalizeLabel(topLook?.whenToWear, ""),
    secondLookName: normalizeLabel(secondLook?.name, ""),
    topLookRole: normalizeLabel(topLookItem?.role || topLook?.role, ""),
    topLookDirection: normalizeLabel(topLookItem?.direction || topLook?.direction, ""),
    topLookVisualWeight: normalizeLabel(topLookItem?.visualWeight || topLook?.visualWeight, ""),
    topLookFormality: normalizeLabel(topLookItem?.formality || topLook?.formality, ""),
    topLookBodyEffect: normalizeLabel(topLookItem?.bodyEffect || topLook?.bodyEffect, ""),
    topLookFaceEffect: normalizeLabel(topLookItem?.faceEffect || topLook?.faceEffect, ""),
    topLookAuthorityRationale: normalizeLabel(topLookItem?.authorityRationale || topLook?.authorityRationale, ""),
    topLookConversionCopy: normalizeLabel(topLookItem?.conversionCopy || topLook?.conversionCopy, ""),
    topLookUseCases: uniqueStrings([
      ...(topLookItem?.useCases || []),
      ...(topLook?.useCases || []),
      topLookItem?.contextOfUse,
      topLook?.useCase,
    ]),
    topLookItemName: normalizeLabel(topLookItem?.premiumTitle || topLookItem?.name, ""),
    topLookItemSummary: buildLookItemSummary(topLookItem, topLook),
    topLook,
    secondLook,
  };
}

export function describeLookIntelligence(look?: WhatsAppLookSummary | null) {
  const item = pickLookItem(look);
  const parts: string[] = [];

  const itemName = normalizeLabel(item?.premiumTitle || item?.name || look?.name, "");
  if (itemName) parts.push(itemName);

  const role = normalizeLabel(item?.role || look?.role, "");
  if (role) parts.push(`atua como ${role.toLowerCase()}`);

  const direction = normalizeLabel(item?.direction || look?.direction, "");
  if (direction) parts.push(`na direção ${direction.toLowerCase()}`);

  const visualWeight = normalizeLabel(item?.visualWeight || look?.visualWeight, "");
  if (visualWeight) parts.push(`com peso visual ${visualWeight.toLowerCase()}`);

  const formality = normalizeLabel(item?.formality || look?.formality, "");
  if (formality) parts.push(`e formalidade ${formality.toLowerCase()}`);

  const bodyEffect = normalizeLabel(item?.bodyEffect || look?.bodyEffect, "");
  if (bodyEffect) parts.push(`no corpo: ${bodyEffect}`);

  const faceEffect = normalizeLabel(item?.faceEffect || look?.faceEffect, "");
  if (faceEffect) parts.push(`no rosto: ${faceEffect}`);

  const useCases = uniqueStrings([
    ...(item?.useCases || []),
    ...(look?.useCases || []),
    item?.contextOfUse,
    look?.whenToWear,
  ]);
  if (useCases.length) parts.push(`uso: ${useCases.slice(0, 2).join(", ")}`);

  const rationale = normalizeLabel(item?.authorityRationale || look?.authorityRationale, "");
  if (rationale) parts.push(rationale);

  const conversion = normalizeLabel(item?.conversionCopy || look?.conversionCopy, "");
  if (conversion) parts.push(conversion);

  if (!parts.length) return "";

  return `A peça que lidera a leitura: ${parts.join(" • ")}.`;
}

export function buildFashionConsultativeReply(
  snapshot: FashionConsultationSnapshot,
  angle: FashionReplyAngle,
  tone: FashionReplyTone,
) {
  const intro = pickIntro(snapshot, angle, tone);
  const reason = pickReason(snapshot, angle);
  const close = pickClose(snapshot, angle, tone);

  return [intro, reason, close].filter(Boolean).join(" ");
}

export function buildFashionSummaryLine(snapshot: FashionConsultationSnapshot) {
  const cues: string[] = [];

  if (snapshot.styleIdentity) cues.push(snapshot.styleIdentity);
  if (snapshot.imageGoal) cues.push(snapshot.imageGoal);
  if (snapshot.paletteFamily) cues.push(snapshot.paletteFamily);
  if (snapshot.fit) cues.push(snapshot.fit);
  if (snapshot.topLookRole) cues.push(snapshot.topLookRole);
  if (snapshot.topLookDirection) cues.push(snapshot.topLookDirection);
  if (snapshot.topLookItemSummary) cues.push(snapshot.topLookItemSummary);

  if (!cues.length) return "Leitura consultiva em andamento";

  return cues.slice(0, 3).join(" • ");
}

function pickIntro(snapshot: FashionConsultationSnapshot, angle: FashionReplyAngle, tone: FashionReplyTone) {
  const firstName = snapshot.firstName;

  switch (angle) {
    case "closing":
      return tone === "direct"
        ? `Fechando de forma limpa, ${firstName}:`
        : tone === "consultive"
          ? `Se eu conduzisse essa decisão para você, ${firstName}, eu faria assim:`
          : `Com cuidado para não empurrar a decisão, ${firstName}:`;
    case "price":
      return tone === "direct"
        ? `Se a dúvida for valor, ${firstName}:`
        : tone === "consultive"
          ? `Pensando no custo de errar a leitura, ${firstName}:`
          : `Antes de comparar preço, ${firstName}:`;
    case "fit":
      return tone === "direct"
        ? `No caimento, ${firstName}:`
        : tone === "consultive"
          ? `Se a sua dúvida for como isso veste, ${firstName}:`
          : `Falando de caimento com mais precisão, ${firstName}:`;
    case "objection":
      return tone === "direct"
        ? `Se eu pudesse te dar uma leitura segura, ${firstName}:`
        : tone === "consultive"
          ? `Para tirar a insegurança sem perder a curadoria, ${firstName}:`
          : `Vamos deixar a decisão mais clara, ${firstName}:`;
    case "desire":
      return tone === "direct"
        ? `O ponto mais forte aqui, ${firstName}, é este:`
        : tone === "consultive"
          ? `O que faz esse look ganhar força, ${firstName}, é o seguinte:`
          : `A leitura de desejo fica mais interessante quando:`;
    case "follow_up":
      return tone === "direct"
        ? `Retomando com objetividade, ${firstName}:`
        : tone === "consultive"
          ? `Voltando para a sua leitura, ${firstName}:`
          : `Só para não perder o timing, ${firstName}:`;
  }
}

function pickReason(snapshot: FashionConsultationSnapshot, angle: FashionReplyAngle) {
  const lookName = snapshot.topLookName || "o look principal";
  const explanation = compactSentence(snapshot.topLookExplanation);
  const wearLine = snapshot.topLookWhenToWear ? `Ele funciona especialmente para ${snapshot.topLookWhenToWear}.` : "";
  const profileLine = buildProfileLine(snapshot);
  const intelligenceLine = describeLookIntelligence(snapshot.topLook);

  switch (angle) {
    case "closing":
      return joinSentences(
        `Eu colocaria ${lookName} na frente porque ele conversa com ${snapshot.styleIdentity} sem perder ${snapshot.imageGoal}.`,
        intelligenceLine,
        explanation ? `A leitura visual já aponta isso: ${explanation}.` : "",
        wearLine,
      );
    case "price":
      return joinSentences(
        `O valor fica mais fácil de justificar quando a peça reduz tentativa e erro e sustenta ${snapshot.imageGoal}.`,
        intelligenceLine,
        profileLine,
        wearLine,
      );
    case "fit":
      return joinSentences(
        `No corpo, ${lookName} ajuda a organizar a leitura de forma mais limpa e coerente.`,
        snapshot.fit ? `O caimento tende a respeitar ${snapshot.fit}.` : "",
        snapshot.topLookBodyEffect ? `A própria peça sugere ${snapshot.topLookBodyEffect.toLowerCase()}.` : "",
        profileLine,
      );
    case "objection":
      return joinSentences(
        `A leitura fica mais segura quando a escolha respeita ${snapshot.styleIdentity} e não briga com o que a pessoa quer projetar.`,
        intelligenceLine,
        profileLine,
        explanation ? `O próprio comentário do look já indica esse caminho: ${explanation}.` : "",
      );
    case "desire":
      return joinSentences(
        `Esse look passa a sensação de ter sido escolhido para a pessoa, não para a arara.`,
        `Ele entrega ${snapshot.imageGoal} com mais presença e menos ruído.`,
        snapshot.topLookConversionCopy ? `A proposta comercial reforça isso: ${snapshot.topLookConversionCopy}.` : "",
        profileLine,
      );
    case "follow_up":
      return joinSentences(
        `Ainda faz sentido seguir com ${lookName}?`,
        intelligenceLine,
        profileLine,
        snapshot.topLookType ? `A leitura anterior já posiciona isso como ${snapshot.topLookType.toLowerCase()}.` : "",
      );
  }
}

function pickClose(snapshot: FashionConsultationSnapshot, angle: FashionReplyAngle, tone: FashionReplyTone) {
  const lookName = snapshot.topLookName || "essa proposta";

  switch (angle) {
    case "closing":
      return tone === "direct"
        ? `Se quiser, eu já te mando o próximo passo e deixo essa decisão pronta no WhatsApp.`
        : `Posso seguir com o link certo e reduzir o caminho até a compra.`;
    case "price":
      return tone === "direct"
        ? `Se você topar, eu te mostro a condição mais coerente agora.`
        : `Se fizer sentido, eu comparo com uma alternativa mais segura sem perder a leitura.`;
    case "fit":
      return tone === "direct"
        ? `Se quiser, eu sigo com a peça e te explico o encaixe antes de fechar.`
        : `Se você quiser, eu detalho o caimento antes de avançar.`;
    case "objection":
      return tone === "direct"
        ? `A ideia aqui é tirar o atrito e deixar a decisão mais segura.`
        : `A partir daqui, eu consigo te guiar sem empurrar catálogo genérico.`;
    case "desire":
      return tone === "direct"
        ? `Se quiser esse efeito, eu sigo com você agora.`
        : `Se esse for o efeito que você quer, eu te mostro como avançar sem perder a elegância.`;
    case "follow_up":
      return tone === "direct"
        ? `Se ainda fizer sentido, eu retomo agora.`
        : `Se quiser, eu reabro essa linha e sigo do ponto exato em que paramos com ${lookName}.`;
  }
}

function buildProfileLine(snapshot: FashionConsultationSnapshot) {
  const parts: string[] = [];
  if (snapshot.paletteFamily) parts.push(`A paleta puxa para ${snapshot.paletteFamily.toLowerCase()}.`);
  if (snapshot.fit) parts.push(`O caimento preferido tende a ser ${snapshot.fit.toLowerCase()}.`);
  if (snapshot.metal) parts.push(`Os metais conversam melhor em ${snapshot.metal.toLowerCase()}.`);
  if (snapshot.topLookIntention) parts.push(`A intenção dominante do look é ${snapshot.topLookIntention.toLowerCase()}.`);
  if (snapshot.topLookAuthorityRationale) parts.push(snapshot.topLookAuthorityRationale);
  return parts.join(" ");
}

function joinSentences(...parts: Array<string | undefined>) {
  return parts.filter((part) => Boolean(part && part.trim())).join(" ");
}

function compactSentence(value: string, limit = 140) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1).trimEnd()}…`;
}

function normalizeLabel(value?: string | null, fallback = "") {
  const trimmed = (value || "").trim();
  return trimmed || fallback;
}

function splitFirstName(fullName: string) {
  return fullName.split(" ").filter(Boolean)[0] || "Cliente";
}

function pickLookItem(look?: WhatsAppLookSummary | null): WhatsAppLookItemContext | null {
  return look?.items?.[0] || null;
}

function buildLookItemSummary(item: WhatsAppLookItemContext | null, look?: WhatsAppLookSummary | null) {
  const parts: string[] = [];
  const title = item?.premiumTitle || item?.name || look?.name;
  if (title) parts.push(title);
  if (item?.functionalBenefit) parts.push(item.functionalBenefit);
  if (item?.socialEffect) parts.push(item.socialEffect);
  const context = item?.contextOfUse || look?.whenToWear;
  if (context) parts.push(context);
  return compactSentence(parts.filter(Boolean).join(" • "), 180);
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => normalizeLabel(value || "", "")).filter(Boolean)));
}
