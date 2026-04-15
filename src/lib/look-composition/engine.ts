/**
 * Smart Look Composition Engine
 * 
 * Sistema que monta looks completos usando múltiplos produtos do catálogo
 * da loja, criando uma experiência de personal stylist real.
 * 
 * Funciona com o try-on existente (fal.ai) mas enriquece a experiência
 * com composições inteligentes de produtos reais do catálogo.
 */

import type { Product } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveLookComposition, type SavedLookComposition } from "./db";

export interface LookComposition {
  id: string;
  name: string;
  description: string;
  anchorPiece: Product;      // Peça principal (vestido, blazer, etc)
  supportPieces: Product[];  // Peças complementares (calça, saia, etc)
  accessories: Product[];    // Acessórios (bolsa, sapato, etc)
  totalPrice: number;
  styleProfile: string;
  occasion: string;
  confidence: number;        // 0-1, quão bom é esse look
}

export interface CompositionInput {
  orgId: string;
  resultId?: string;
  leadId?: string;
  userPhotoUrl?: string;
  styleDirection?: string;
  imageGoal?: string;
  bodyFit?: string;
  colorContrast?: string;
  essenceLabel?: string;
  paletteFamily?: string;
  budget?: 'economy' | 'standard' | 'premium';
  occasion?: 'casual' | 'work' | 'night' | 'special';
}

// Regras de composição por tipo de âncora
const COMPOSITION_RULES: Record<string, {
  supports: string[];
  accessories: string[];
  maxSupportPieces: number;
  maxAccessories: number;
}> = {
  'vestido': {
    supports: ['blazer', 'casaco', 'jaqueta', 'cinto'],
    accessories: ['bolsa', 'sapato', 'sapatilha', 'bota', 'colar', 'brinco'],
    maxSupportPieces: 1,
    maxAccessories: 3,
  },
  'blazer': {
    supports: ['calca', 'saia', 'vestido', 'blusa', 'camisa'],
    accessories: ['bolsa', 'sapato', 'scarpin', 'bota', 'colar', 'relogio'],
    maxSupportPieces: 2,
    maxAccessories: 3,
  },
  'calca': {
    supports: ['blusa', 'camisa', 'blazer', 'casaco', 'body'],
    accessories: ['bolsa', 'sapato', 'tenis', 'bota', 'cinto', 'colar'],
    maxSupportPieces: 2,
    maxAccessories: 3,
  },
  'saia': {
    supports: ['blusa', 'camisa', 'body', 'blazer', 'casaco'],
    accessories: ['bolsa', 'sapato', 'sandalia', 'bota', 'cinto', 'brinco'],
    maxSupportPieces: 2,
    maxAccessories: 3,
  },
  'blusa': {
    supports: ['calca', 'saia', 'blazer', 'casaco', 'short'],
    accessories: ['bolsa', 'sapato', 'tenis', 'sandalia', 'colar', 'brinco'],
    maxSupportPieces: 2,
    maxAccessories: 3,
  },
  'default': {
    supports: ['blusa', 'calca', 'saia', 'blazer', 'casaco'],
    accessories: ['bolsa', 'sapato', 'colar', 'brinco', 'cinto'],
    maxSupportPieces: 2,
    maxAccessories: 2,
  },
};

function detectAnchorCategory(product: Product): string {
  const name = product.name.toLowerCase();
  const category = (product.category || '').toLowerCase();
  const tags = (product.category_tags || []).join(' ').toLowerCase();
  
  const source = `${name} ${category} ${tags}`;
  
  if (source.includes('vestido') || source.includes('dress')) return 'vestido';
  if (source.includes('blazer') || source.includes('terno')) return 'blazer';
  if (source.includes('calca') || source.includes('calça') || source.includes('pants')) return 'calca';
  if (source.includes('saia') || source.includes('skirt')) return 'saia';
  if (source.includes('blusa') || source.includes('camisa') || source.includes('shirt')) return 'blusa';
  
  return 'default';
}

function calculateCompatibilityScore(
  anchor: Product,
  candidate: Product,
  userProfile: Partial<CompositionInput>
): number {
  let score = 0.5; // Base score
  
  // Cor compatível
  if (anchor.primary_color && candidate.primary_color) {
    const anchorColor = anchor.primary_color.toLowerCase();
    const candidateColor = candidate.primary_color.toLowerCase();
    
    // Cores iguais ou neutras
    if (anchorColor === candidateColor) score += 0.1;
    if (candidateColor.includes('preto') || candidateColor.includes('branco') || candidateColor.includes('bege')) {
      score += 0.15; // Neutros são mais versáteis
    }
  }
  
  // Estilo compatível
  if (anchor.style && candidate.style) {
    if (anchor.style === candidate.style) score += 0.15;
  }
  
  // Tags de estilo compatíveis
  const anchorTags = new Set(anchor.style_tags || []);
  const candidateTags = candidate.style_tags || [];
  const matchingTags = candidateTags.filter(tag => anchorTags.has(tag));
  score += matchingTags.length * 0.05;
  
  // Direção de estilo do usuário
  if (userProfile.styleDirection) {
    const userStyle = userProfile.styleDirection.toLowerCase();
    const candidateStyle = (candidate.style || '').toLowerCase();
    if (candidateStyle.includes(userStyle)) score += 0.1;
  }
  
  // Ocasião compatível
  if (userProfile.occasion && candidate.occasion_tags) {
    const occasionMap: Record<string, string[]> = {
      'casual': ['casual', 'dia-a-dia', 'street'],
      'work': ['trabalho', 'executivo', 'business', 'escritorio'],
      'night': ['noite', 'festa', 'evento', 'jantar'],
      'special': ['evento', 'festa', 'casamento', 'formatura'],
    };
    
    const validOccasions = occasionMap[userProfile.occasion] || [];
    const hasMatchingOccasion = candidate.occasion_tags.some(tag => 
      validOccasions.some(vo => tag.toLowerCase().includes(vo))
    );
    if (hasMatchingOccasion) score += 0.15;
  }
  
  // Preço dentro do orçamento
  if (userProfile.budget && candidate.price_range) {
    const budgetRanges: Record<string, string[]> = {
      'economy': ['baixo', 'acessivel', 'popular'],
      'standard': ['medio', 'standard', 'moderado'],
      'premium': ['alto', 'premium', 'luxo'],
    };
    
    const validRanges = budgetRanges[userProfile.budget] || [];
    if (validRanges.some(r => candidate.price_range?.toLowerCase().includes(r))) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1);
}

export async function composeLooksFromCatalog(
  input: CompositionInput,
  saveToDatabase: boolean = false
): Promise<LookComposition[]> {
  const admin = createAdminClient();
  
  // Buscar todos os produtos da loja
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('org_id', input.orgId)
    .not('image_url', 'is', null);
  
  if (!products || products.length === 0) {
    return [];
  }
  
  // Separar produtos por categoria
  const byCategory: Record<string, Product[]> = {};
  
  for (const product of products) {
    const category = detectAnchorCategory(product);
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(product);
  }
  
  const compositions: LookComposition[] = [];
  
  // Para cada categoria de âncora possível
  for (const [anchorCategory, anchorProducts] of Object.entries(byCategory)) {
    const rules = COMPOSITION_RULES[anchorCategory] || COMPOSITION_RULES.default;
    
    // Pegar até 3 âncoras por categoria
    for (const anchor of anchorProducts.slice(0, 3)) {
      const supportPieces: Product[] = [];
      const accessories: Product[] = [];
      
      // Encontrar peças de suporte compatíveis
      for (const supportCategory of rules.supports) {
        if (supportPieces.length >= rules.maxSupportPieces) break;
        
        const candidates = byCategory[supportCategory] || [];
        const scoredCandidates = candidates
          .filter(c => c.id !== anchor.id) // Não repetir a mesma peça
          .map(c => ({
            product: c,
            score: calculateCompatibilityScore(anchor, c, input),
          }))
          .sort((a, b) => b.score - a.score);
        
        if (scoredCandidates.length > 0 && scoredCandidates[0].score > 0.6) {
          supportPieces.push(scoredCandidates[0].product);
        }
      }
      
      // Encontrar acessórios compatíveis
      for (const accessoryCategory of rules.accessories) {
        if (accessories.length >= rules.maxAccessories) break;
        
        const candidates = byCategory[accessoryCategory] || [];
        const scoredCandidates = candidates
          .filter(c => c.id !== anchor.id && !supportPieces.some(s => s.id === c.id))
          .map(c => ({
            product: c,
            score: calculateCompatibilityScore(anchor, c, input),
          }))
          .sort((a, b) => b.score - a.score);
        
        if (scoredCandidates.length > 0 && scoredCandidates[0].score > 0.5) {
          accessories.push(scoredCandidates[0].product);
        }
      }
      
      // Só criar composição se tivermos pelo menos 1 peça de suporte ou acessório
      if (supportPieces.length > 0 || accessories.length > 0) {
        const allPieces = [anchor, ...supportPieces, ...accessories];
        const totalPrice = allPieces.reduce((sum, p) => {
          // Extrair preço se disponível (simplificado)
          return sum + 0; // Preço real viria de outra tabela
        }, 0);
        
        const avgConfidence = (
          supportPieces.reduce((sum, p) => sum + calculateCompatibilityScore(anchor, p, input), 0) +
          accessories.reduce((sum, p) => sum + calculateCompatibilityScore(anchor, p, input), 0)
        ) / (supportPieces.length + accessories.length || 1);
        
        compositions.push({
          id: `look-${anchor.id}-${Date.now()}`,
          name: generateLookName(anchor, supportPieces, input),
          description: generateLookDescription(anchor, supportPieces, accessories, input),
          anchorPiece: anchor,
          supportPieces,
          accessories,
          totalPrice,
          styleProfile: anchor.style || 'versatil',
          occasion: input.occasion || 'casual',
          confidence: avgConfidence,
        });
      }
    }
  }
  
  // Ordenar por confiança
  const sortedCompositions = compositions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  // Salvar no banco se solicitado
  if (saveToDatabase && input.resultId) {
    for (const composition of sortedCompositions) {
      try {
        await saveLookComposition(composition, {
          orgId: input.orgId,
          resultId: input.resultId,
        });
      } catch (err) {
        console.error("[composeLooksFromCatalog] Error saving composition:", err);
        // Continuar mesmo se falhar ao salvar
      }
    }
  }

  return sortedCompositions;
}

function generateLookName(
  anchor: Product,
  supports: Product[],
  input: Partial<CompositionInput>
): string {
  const anchorName = anchor.name.split(' ').slice(0, 2).join(' ');
  
  if (input.essenceLabel) {
    return `Look ${input.essenceLabel}: ${anchorName}`;
  }
  
  if (input.occasion) {
    const occasionNames: Record<string, string> = {
      'casual': 'Dia a Dia',
      'work': 'Executivo',
      'night': 'Noite',
      'special': 'Especial',
    };
    return `Look ${occasionNames[input.occasion]}: ${anchorName}`;
  }
  
  return `Look Completo: ${anchorName}`;
}

function generateLookDescription(
  anchor: Product,
  supports: Product[],
  accessories: Product[],
  input: Partial<CompositionInput>
): string {
  const parts: string[] = [];
  
  parts.push(`Âncora: ${anchor.name}`);
  
  if (supports.length > 0) {
    parts.push(`Combinado com: ${supports.map(s => s.name).join(', ')}`);
  }
  
  if (accessories.length > 0) {
    parts.push(`Acessórios: ${accessories.map(a => a.name).join(', ')}`);
  }
  
  if (input.styleDirection) {
    parts.push(`Estilo: ${input.styleDirection}`);
  }
  
  return parts.join('. ');
}

// Função para gerar prompt enriquecido para try-on
export function generateEnrichedTryOnPrompt(
  composition: LookComposition,
  userProfile: Partial<CompositionInput>
): string {
  const parts: string[] = [];
  
  // Descrição da peça principal
  parts.push(`Professional fashion photo of a person wearing ${composition.anchorPiece.name}`);
  
  // Características do usuário
  if (userProfile.bodyFit) {
    parts.push(`, ${userProfile.bodyFit} fit`);
  }
  
  // Estilo
  if (composition.styleProfile) {
    parts.push(`, ${composition.styleProfile} style`);
  }
  
  // Contexto
  if (userProfile.occasion) {
    const occasionContexts: Record<string, string> = {
      'casual': 'casual everyday setting',
      'work': 'professional office environment',
      'night': 'evening event setting',
      'special': 'elegant special occasion',
    };
    parts.push(`, ${occasionContexts[userProfile.occasion]}`);
  }
  
  // Qualidade
  parts.push(', high quality, photorealistic, professional lighting');
  
  return parts.join('');
}

// Sugerir próximo item para compra baseado no look atual
export async function suggestNextPurchase(
  currentComposition: LookComposition,
  orgId: string
): Promise<Product | null> {
  const admin = createAdminClient();
  
  // Buscar produtos que complementam o look atual
  const { data: products } = await admin
    .from('products')
    .select('*')
    .eq('org_id', orgId)
    .not('image_url', 'is', null);
  
  if (!products) return null;
  
  // Produtos que não estão no look atual
  const currentIds = new Set([
    currentComposition.anchorPiece.id,
    ...currentComposition.supportPieces.map(p => p.id),
    ...currentComposition.accessories.map(p => p.id),
  ]);
  
  const candidates = products.filter(p => !currentIds.has(p.id));
  
  // Scorear por compatibilidade com o look completo
  const scored = candidates.map(candidate => {
    let score = 0;
    
    // Compatível com âncora
    score += calculateCompatibilityScore(currentComposition.anchorPiece, candidate, {}) * 0.4;
    
    // Compatível com peças de suporte
    for (const support of currentComposition.supportPieces) {
      score += calculateCompatibilityScore(support, candidate, {}) * 0.3;
    }
    
    // Compatível com acessórios
    for (const accessory of currentComposition.accessories) {
      score += calculateCompatibilityScore(accessory, candidate, {}) * 0.2;
    }
    
    return { product: candidate, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  return scored.length > 0 && scored[0].score > 0.5 ? scored[0].product : null;
}
