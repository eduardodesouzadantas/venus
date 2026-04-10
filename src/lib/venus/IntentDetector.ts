import type { VenusConversationMessage, VenusIntent } from "./types";

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasKeyword(message: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(message));
}

export function detectIntent(message: string, history: VenusConversationMessage[]): VenusIntent {
  const msg = normalize(message);
  const userMessages = history.filter((entry) => normalize(entry.sender) !== "venus" && normalize(entry.text));

  if (userMessages.length <= 1) {
    return "primeira_mensagem";
  }

  if (hasKeyword(msg, [/falar com/i, /atendente/i, /humano/i, /pessoa real/i, /gerente/i, /equipe/i])) {
    return "humano";
  }

  if (hasKeyword(msg, [/quanto/i, /preco/i, /caro/i, /valor/i, /desconto/i, /promo/i, /barato/i, /custa/i, /pix/i])) {
    return "preco";
  }

  if (hasKeyword(msg, [/quero comprar/i, /vou levar/i, /garante/i, /fechar/i, /fechamos/i, /manda o link/i, /como pago/i, /cartao/i])) {
    return "compra";
  }

  if (hasKeyword(msg, [/mas\b/i, /porem/i, /porém/i, /nao sei/i, /não sei/i, /talvez/i, /depois/i, /ainda nao/i, /ainda não/i])) {
    return "objecao";
  }

  if (hasKeyword(msg, [/sumiu/i, /sumi/i, /cad[eê]/i, /volta/i, /volte/i, /some/i])) {
    return "sumiu";
  }

  if (hasKeyword(msg, [/gostei/i, /adorei/i, /quero ver/i, /me mostra/i, /como fica/i, /tem no/i, /tem tamanho/i, /qual tamanho/i, /combina/i, /serve/i])) {
    return "interesse";
  }

  if (hasKeyword(msg, [/o que eh/i, /o que e/i, /como eh/i, /como e/i, /serve para/i, /posso usar/i, /como usar/i, /combina com/i, /sobre a pe/i])) {
    return "curiosidade";
  }

  return history.length > 4 ? "interesse" : "curiosidade";
}
