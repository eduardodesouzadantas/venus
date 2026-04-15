/**
 * WhatsApp Look Follow-up System
 * 
 * Sistema que continua a conversa no WhatsApp oferecendo:
 * - Looks alternativos baseados no perfil
 * - Upsell de peças complementares
 * - Cross-sell de acessórios
 * - Sugestões por ocasião/paleta
 * 
 * A máquina de vendas real acontece aqui!
 */

import type { Product } from "@/lib/catalog";
import type { LookComposition } from "@/lib/look-composition/engine";
import { composeLooksFromCatalog } from "@/lib/look-composition/engine";
import { buildCatalogAccessCopy, type CatalogAccessCopy } from "@/lib/catalog-query/presentation";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export interface FollowUpContext {
  orgId: string;
  leadId?: string;
  conversationId: string;
  customerName?: string;
  customerPhone: string;
  
  // Perfil analisado
  essenceLabel?: string;
  paletteFamily?: string;
  colorSeason?: string;
  bodyFit?: string;
  styleDirection?: string;
  imageGoal?: string;
  
  // Histórico
  viewedLooks: string[];
  purchasedLooks: string[];
  lastLookId?: string;
  
  // Contexto da conversa
  messageCount: number;
  lastMessageAt?: string;
}

export interface FollowUpSuggestion {
  type: 'alternative_look' | 'complementary_piece' | 'accessory_bundle' | 'occasion_look' | 'palette_match';
  priority: number; // 1-10
  message: string;
  look?: LookComposition;
  products: Product[];
  reasoning: string; // Por que essa sugestão faz sentido
  urgency?: 'low' | 'medium' | 'high';
  discount?: {
    percentage: number;
    reason: string;
  };
}

export type WhatsAppFollowUpSurfaceItem = {
  id: string;
  title: string;
  justification: string;
  ctaLabel: string;
  typeLabel: string;
  supportingPieces: string[];
};

export type WhatsAppFollowUpPresentation = {
  copy: CatalogAccessCopy;
  reinforcement: string[];
  suggestions: WhatsAppFollowUpSurfaceItem[];
  emptyState: {
    title: string;
    summary: string;
  };
  actions: {
    moreOptionsLabel: string;
    talkToVenusLabel: string;
    catalogLabel: string;
    continueLabel: string;
    saveLabel: string;
    opinionLabel: string;
  };
};

function truncateText(value: string, limit = 92): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).replace(/\s+\S*$/, "").trim() || normalized.slice(0, limit).trim()}…`;
}

function buildSuggestionTitle(suggestion: FollowUpSuggestion, index: number): string {
  if (suggestion.look?.name) {
    return suggestion.look.name;
  }

  const productTitle = suggestion.products[0]?.name || "";
  if (productTitle) {
    return productTitle;
  }

  return `Opção ${index + 1}`;
}

function buildSuggestionSupportingPieces(suggestion: FollowUpSuggestion): string[] {
  const lookPieces = suggestion.look
    ? [
        suggestion.look.anchorPiece?.name,
        ...suggestion.look.supportPieces.slice(0, 2).map((piece) => piece.name),
      ]
    : [];

  const productPieces = suggestion.products.slice(0, 3).map((product) => product.name);
  return [...lookPieces, ...productPieces]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 3);
}

export function buildWhatsAppFollowUpPresentation(
  _context: FollowUpContext,
  suggestions: FollowUpSuggestion[],
  options?: {
    sourceLabel?: string | null;
    explicit?: boolean;
  }
): WhatsAppFollowUpPresentation {
  const sourceLabel = normalizeText(options?.sourceLabel) || "catálogo da loja";
  const topSuggestions = suggestions.slice(0, 3);
  const productCount = topSuggestions.reduce((count, suggestion) => count + suggestion.products.length, 0);
  const lookCount = topSuggestions.reduce((count, suggestion) => count + (suggestion.look ? 1 : 0), 0);
  const copy = buildCatalogAccessCopy({
    sourceLabel,
    productCount,
    lookCount,
    explicit: Boolean(options?.explicit),
  });

  const items = topSuggestions.map((suggestion, index) => {
    const title = buildSuggestionTitle(suggestion, index);
    const supportingPieces = buildSuggestionSupportingPieces(suggestion);
    const justification = truncateText(
      suggestion.reasoning || suggestion.message || "Leitura assistida e coerente com a conversa.",
      96
    );

    return {
      id: `${suggestion.type}-${index + 1}`,
      title,
      justification,
      ctaLabel:
        suggestion.look || suggestion.products.length > 1
          ? index === 0
            ? "Ver mais 1 opcao"
            : "Falar com a Venus sobre esse look"
          : "Continuar conversa",
      typeLabel:
        suggestion.type === "alternative_look"
          ? "Look alternativo"
          : suggestion.type === "complementary_piece"
            ? "Peca complementar"
            : suggestion.type === "accessory_bundle"
              ? "Kit de acessorios"
              : suggestion.type === "occasion_look"
                ? "Look por ocasiao"
                : "Paleta assistida",
      supportingPieces,
    } satisfies WhatsAppFollowUpSurfaceItem;
  });

  const reinforcement = [
    copy.eyebrow,
    truncateText(items[0]?.justification || copy.summary, 72),
    items[0]?.typeLabel || "Leitura assistida",
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .slice(0, 3);

  return {
    copy,
    reinforcement,
    suggestions: items,
    emptyState: {
      title: "Ainda sem novas opcoes",
      summary: "Quando o catalogo responder, eu mostro ate 3 caminhos sem quebrar o contexto da conversa.",
    },
    actions: {
      moreOptionsLabel: "Ver mais 1 opcao",
      talkToVenusLabel: "Falar com a Venus sobre esse look",
      catalogLabel: copy.openLabel,
      continueLabel: copy.continueLabel,
      saveLabel: copy.saveLabel,
      opinionLabel: "Pedir opiniao",
    },
  };
}

export function buildWhatsAppFollowUpMessagePreview(
  context: FollowUpContext,
  presentation: WhatsAppFollowUpPresentation
) {
  const lines: string[] = [];

  if (context.messageCount === 0) {
    lines.push(`Oi${context.customerName ? `, ${context.customerName}` : ""}!`);
    lines.push("Separei uma leitura assistida com até 3 caminhos para continuar sem perder contexto.");
  } else {
    lines.push(`Mais opções para você${context.customerName ? `, ${context.customerName}` : ""}:`);
    lines.push("Mantive a mesma leitura para não começar do zero.");
  }

  lines.push("");
  lines.push(presentation.copy.summary);
  lines.push("");

  for (const [index, suggestion] of presentation.suggestions.slice(0, 3).entries()) {
    lines.push(`${index + 1}. ${suggestion.title} — ${suggestion.justification}`);

    if (suggestion.supportingPieces.length > 0) {
      lines.push(`   • ${suggestion.supportingPieces.slice(0, 3).join(" • ")}`);
    }

    lines.push(`   • ${suggestion.ctaLabel}`);
    lines.push("");
  }

  lines.push(`${presentation.actions.moreOptionsLabel}. ${presentation.actions.talkToVenusLabel}.`);
  lines.push(`Se quiser abrir o catálogo, eu sigo por ${presentation.actions.catalogLabel}.`);

  return lines.join("\n");
}

// Templates de mensagens de follow-up
const FOLLOWUP_TEMPLATES = {
  alternative_look: [
    "Que tal também experimentar esse look? Ele valoriza ainda mais seu perfil {essence}:",
    "Baseado no seu estilo, montei essa outra opção que combina com você:",
    "Essa é uma alternativa incrível para o seu perfil {essence}:",
  ],
  
  complementary_piece: [
    "Esse item complementa perfeitamente o look que você escolheu:",
    "Para completar seu look, que tal adicionar:",
    "Esse acessório vai elevar seu look a outro nível:",
  ],
  
  accessory_bundle: [
    "Montei um kit de acessórios exclusivo para você:",
    "Esses acessórios foram selecionados para combinar com seu estilo:",
    "Complete seu look com esses itens:",
  ],
  
  occasion_look: [
    "Para sua próxima ocasião especial, que tal esse look:",
    "Esse look é perfeito para {occasion}:",
    "Separei esse look especial para você:",
  ],
  
  palette_match: [
    "Essas peças combinam perfeitamente com sua paleta de cores:",
    "Baseado na sua colorimetria, essas peças vão valorizar sua imagem:",
    "Essas cores foram feitas para você:",
  ],
  
  urgency: [
    "⏰ Últimas unidades disponíveis!",
    "🔥 Esse look está em alta demanda",
    "✨ Exclusivo para clientes Venus",
  ],
  
  social_proof: [
    "💬 Outras clientes com seu perfil amaram esse look",
    "⭐ Look mais vendido essa semana",
    "🛍️ Clientes que compraram o look anterior também levaram esse",
  ],
};

export async function generateFollowUpSuggestions(
  context: FollowUpContext
): Promise<FollowUpSuggestion[]> {
  const suggestions: FollowUpSuggestion[] = [];
  
  // 1. Looks alternativos (sempre oferecer 2-3 opções diferentes)
  const alternativeLooks = await generateAlternativeLooks(context);
  suggestions.push(...alternativeLooks);
  
  // 2. Peças complementares ao último look visto
  if (context.lastLookId) {
    const complementary = await generateComplementaryPieces(context);
    suggestions.push(...complementary);
  }
  
  // 3. Bundles de acessórios
  const accessoryBundles = await generateAccessoryBundles(context);
  suggestions.push(...accessoryBundles);
  
  // 4. Looks por ocasião específica
  const occasionLooks = await generateOccasionLooks(context);
  suggestions.push(...occasionLooks);
  
  // 5. Match de paleta de cores
  const paletteMatches = await generatePaletteMatches(context);
  suggestions.push(...paletteMatches);
  
  // Ordenar por prioridade
  return suggestions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5); // Máximo 5 sugestões por mensagem
}

async function generateAlternativeLooks(
  context: FollowUpContext
): Promise<FollowUpSuggestion[]> {
  const suggestions: FollowUpSuggestion[] = [];
  
  // Gerar looks com variações de estilo
  const styleVariations = [
    { ...context, styleDirection: 'elegante', occasion: 'work' as const },
    { ...context, styleDirection: 'casual', occasion: 'casual' as const },
    { ...context, styleDirection: 'sofisticado', occasion: 'night' as const },
  ];
  
  for (const variation of styleVariations.slice(0, 2)) {
    const looks = await composeLooksFromCatalog({
      orgId: context.orgId,
      styleDirection: variation.styleDirection,
      imageGoal: variation.imageGoal,
      bodyFit: variation.bodyFit,
      colorContrast: variation.colorSeason,
      essenceLabel: variation.essenceLabel,
      paletteFamily: variation.paletteFamily,
      occasion: variation.occasion,
    });
    
    // Filtrar looks já vistos
    const newLooks = looks.filter(l => !context.viewedLooks.includes(l.id));
    
    if (newLooks.length > 0) {
      const look = newLooks[0];
      suggestions.push({
        type: 'alternative_look',
        priority: 8,
        message: selectTemplate('alternative_look', { essence: context.essenceLabel || 'pessoal' }),
        look,
        products: [look.anchorPiece, ...look.supportPieces, ...look.accessories],
        reasoning: `Look alternativo no estilo ${variation.styleDirection} para variar do anterior`,
        urgency: 'medium',
      });
    }
  }
  
  return suggestions;
}

async function generateComplementaryPieces(
  context: FollowUpContext
): Promise<FollowUpSuggestion[]> {
  if (!context.lastLookId) return [];
  
  const admin = createAdminClient();
  
  // Buscar último look
  const { data: lastLook } = await admin
    .from('look_compositions')
    .select('*')
    .eq('id', context.lastLookId)
    .single();
  
  if (!lastLook) return [];
  
  const suggestions: FollowUpSuggestion[] = [];
  const metadata = lastLook.metadata as Record<string, unknown>;
  const anchorPiece = metadata.anchor_piece as Product;
  
  // Buscar produtos que complementam a peça âncora
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('org_id', context.orgId)
    .not('id', 'in', `(${lastLook.anchor_piece_id},${lastLook.support_piece_ids.join(',')})`)
    .limit(10);
  
  if (products && products.length > 0) {
    // Scorear por compatibilidade
    const scored = products.map(p => ({
      product: p,
      score: calculateComplementScore(anchorPiece, p, context),
    })).sort((a, b) => b.score - a.score);
    
    if (scored.length > 0 && scored[0].score > 0.6) {
      suggestions.push({
        type: 'complementary_piece',
        priority: 9,
        message: selectTemplate('complementary_piece'),
        products: [scored[0].product],
        reasoning: `Peça que complementa ${anchorPiece.name} baseado na paleta ${context.paletteFamily}`,
        urgency: 'high',
      });
    }
  }
  
  return suggestions;
}

async function generateAccessoryBundles(
  context: FollowUpContext
): Promise<FollowUpSuggestion[]> {
  const admin = createAdminClient();
  
  // Buscar acessórios da loja
  const { data: accessories } = await admin
    .from('products')
    .select('*')
    .eq('org_id', context.orgId)
    .or('category.ilike.%acessorio%,category.ilike.%acessório%,category.ilike.%bolsa%,category.ilike.%sapato%')
    .limit(15);
  
  if (!accessories || accessories.length < 2) return [];
  
  // Agrupar por categoria
  const byCategory: Record<string, Product[]> = {};
  for (const acc of accessories) {
    const cat = acc.category?.toLowerCase() || 'outros';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(acc);
  }
  
  // Montar bundle (1 de cada categoria principal)
  const bundle: Product[] = [];
  const categories = Object.keys(byCategory).slice(0, 3);
  
  for (const cat of categories) {
    const items = byCategory[cat];
    // Escolher item que combina com a paleta
    const matching = items.find(i => 
      i.primary_color && context.paletteFamily && 
      isColorInPalette(i.primary_color, context.paletteFamily)
    ) || items[0];
    
    if (matching) bundle.push(matching);
  }
  
  if (bundle.length >= 2) {
    return [{
      type: 'accessory_bundle',
      priority: 7,
      message: selectTemplate('accessory_bundle'),
      products: bundle,
      reasoning: `Kit de ${bundle.length} acessórios selecionados para seu perfil ${context.essenceLabel}`,
      discount: {
        percentage: 10,
        reason: 'Comprando o kit completo',
      },
    }];
  }
  
  return [];
}

async function generateOccasionLooks(
  context: FollowUpContext
): Promise<FollowUpSuggestion[]> {
  const suggestions: FollowUpSuggestion[] = [];
  
  // Ocasiões que ainda não foram exploradas
  const occasions = [
    { type: 'work', label: 'trabalho' },
    { type: 'night', label: 'noite' },
    { type: 'special', label: 'eventos especiais' },
  ];
  
  for (const occasion of occasions.slice(0, 1)) {
    const looks = await composeLooksFromCatalog({
      orgId: context.orgId,
      styleDirection: context.styleDirection,
      essenceLabel: context.essenceLabel,
      paletteFamily: context.paletteFamily,
      occasion: occasion.type as 'work' | 'night' | 'special',
    });
    
    const newLooks = looks.filter(l => !context.viewedLooks.includes(l.id));
    
    if (newLooks.length > 0) {
      suggestions.push({
        type: 'occasion_look',
        priority: 6,
        message: selectTemplate('occasion_look', { occasion: occasion.label }),
        look: newLooks[0],
        products: [newLooks[0].anchorPiece, ...newLooks[0].supportPieces],
        reasoning: `Look específico para ocasiões de ${occasion.label}`,
      });
    }
  }
  
  return suggestions;
}

async function generatePaletteMatches(
  context: FollowUpContext
): Promise<FollowUpSuggestion[]> {
  if (!context.paletteFamily) return [];
  
  const admin = createAdminClient();
  
  // Buscar produtos nas cores da paleta do cliente
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('org_id', context.orgId)
    .limit(20);
  
  if (!products) return [];
  
  // Filtrar por cores compatíveis
  const matchingProducts = products.filter(p => 
    p.primary_color && isColorInPalette(p.primary_color, context.paletteFamily!)
  );
  
  if (matchingProducts.length >= 2) {
    return [{
      type: 'palette_match',
      priority: 8,
      message: selectTemplate('palette_match'),
      products: matchingProducts.slice(0, 3),
      reasoning: `Peças na paleta ${context.paletteFamily} que valorizam sua colorimetria`,
      urgency: 'medium',
    }];
  }
  
  return [];
}

// Helpers
function selectTemplate(type: keyof typeof FOLLOWUP_TEMPLATES, vars?: Record<string, string>): string {
  const templates = FOLLOWUP_TEMPLATES[type];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  if (!vars) return template;
  
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);
}

function calculateComplementScore(anchor: Product, candidate: Product, context: FollowUpContext): number {
  let score = 0.5;
  
  // Cor complementar
  if (anchor.primary_color && candidate.primary_color) {
    const anchorColor = anchor.primary_color.toLowerCase();
    const candidateColor = candidate.primary_color.toLowerCase();
    
    // Cores neutras são mais versáteis
    if (['preto', 'branco', 'bege', 'cinza', 'nude'].some(c => candidateColor.includes(c))) {
      score += 0.2;
    }
    
    // Combinação âncora colorida + complemento neutro (ou vice-versa)
    const anchorIsNeutral = ['preto', 'branco', 'bege', 'cinza'].some(c => anchorColor.includes(c));
    const candidateIsNeutral = ['preto', 'branco', 'bege', 'cinza'].some(c => candidateColor.includes(c));
    
    if ((anchorIsNeutral && !candidateIsNeutral) || (!anchorIsNeutral && candidateIsNeutral)) {
      score += 0.15;
    }
  }
  
  // Estilo compatível
  if (anchor.style && candidate.style && anchor.style === candidate.style) {
    score += 0.1;
  }
  
  // Tags compatíveis
  const anchorTags = new Set(anchor.style_tags || []);
  const candidateTags = candidate.style_tags || [];
  const matchingTags = candidateTags.filter(t => anchorTags.has(t));
  score += matchingTags.length * 0.05;
  
  return Math.min(score, 1);
}

function isColorInPalette(color: string, palette: string): boolean {
  const colorLower = color.toLowerCase();
  const paletteLower = palette.toLowerCase();
  
  // Mapeamento simplificado de paletas
  const paletteColors: Record<string, string[]> = {
    'quente': ['vermelho', 'laranja', 'amarelo', 'dourado', 'terracota', 'coral'],
    'frio': ['azul', 'verde', 'roxo', 'prata', 'rosa frio', 'turquesa'],
    'neutro': ['preto', 'branco', 'cinza', 'bege', 'marrom', 'nude'],
    'pastel': ['rosa', 'azul claro', 'verde menta', 'lavanda', 'pêssego'],
  };
  
  const colors = paletteColors[paletteLower] || [];
  return colors.some(c => colorLower.includes(c));
}

// Função principal para gerar mensagem de follow-up completa
export async function generateWhatsAppFollowUpMessage(
  context: FollowUpContext
): Promise<{
  message: string;
  suggestions: FollowUpSuggestion[];
  hasMoreOptions: boolean;
}> {
  const suggestions = await generateFollowUpSuggestions(context);
  
  if (suggestions.length === 0) {
    return {
      message: "Obrigada pelo seu interesse! Se precisar de mais alguma coisa, é só me chamar. 💫",
      suggestions: [],
      hasMoreOptions: false,
    };
  }
  
  // Montar mensagem principal
  const lines: string[] = [];
  
  // Saudação contextual
  if (context.messageCount === 0) {
    lines.push(`Oi${context.customerName ? `, ${context.customerName}` : ''}! 👋`);
    lines.push('');
    lines.push('Aqui está o look que você escolheu:');
  } else {
    lines.push(`Mais opções para você${context.customerName ? `, ${context.customerName}` : ''}:`);
  }
  
  lines.push('');
  
  // Adicionar sugestões principais
  const topSuggestions = suggestions.slice(0, 3);
  
  for (let i = 0; i < topSuggestions.length; i++) {
    const suggestion = topSuggestions[i];
    
    lines.push(`${i + 1}. ${suggestion.message}`);
    lines.push('');
    
    // Listar produtos
    for (const product of suggestion.products.slice(0, 3)) {
      lines.push(`   • ${product.name}`);
    }
    
    if (suggestion.look) {
      lines.push(`   • ${suggestion.look.anchorPiece.name}`);
      for (const piece of suggestion.look.supportPieces.slice(0, 2)) {
        lines.push(`   • ${piece.name}`);
      }
    }
    
    // Desconto especial
    if (suggestion.discount) {
      lines.push(`   🏷️ ${suggestion.discount.percentage}% OFF ${suggestion.discount.reason}`);
    }
    
    lines.push('');
  }
  
  // CTA final
  lines.push('Qual desses você gostou mais? Posso montar mais opções! ✨');
  lines.push('');
  lines.push('Para comprar, é só me dizer o número da opção que eu separo tudo para você.');
  
  return {
    message: lines.join('\n'),
    suggestions,
    hasMoreOptions: suggestions.length > 3,
  };
}
