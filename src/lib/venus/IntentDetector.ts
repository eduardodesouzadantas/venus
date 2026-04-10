import { VenusContext } from "./VenusStylist";

export function detectIntent(
  message: string,
  history: VenusContext["conversationHistory"]
): VenusContext["conversationState"] {
  const msg = message.toLowerCase().trim();
  const isFirstMessage = history.filter((h) => h.sender === "user").length <= 1;

  if (isFirstMessage) return "first_message";

  if (/quero falar com|falar com algu[eé]m|atendente|humano|pessoa real|gerente/i.test(msg))
    return "needs_human";

  if (/quero comprar|vou levar|quero garantir|pode separar|me manda o link|como pago|pix|cart[aã]o|parcela/i.test(msg))
    return "ready_to_buy";

  if (/caro|price|valor|desconto|promo|barato|investimento|custo|quanto custa/i.test(msg))
    return "price_objection";

  if (/n[aã]o sei|talvez|vou pensar|deixa eu ver|depois|n[aã]o tenho certeza/i.test(msg))
    return "objection";

  if (/gostei|adorei|quero ver|me mostra|como fica|tem o meu|qual tamanho|tem no/i.test(msg))
    return "interest";

  if (/o que [eé]|como [eé]|[eé] bom|combina|serve para|posso usar/i.test(msg))
    return "curiosity";

  return "general";
}
