import OpenAI from "openai";
import { OnboardingData } from "@/types/onboarding";
import { Product } from "@/lib/catalog";
import { ResultPayload } from "@/types/result";

export async function generateOpenAIRecommendation(userData: OnboardingData, catalog: Product[]): Promise<ResultPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const openai = new OpenAI({ apiKey });

  // Prepara os dados para o prompt
  const userProfileInfo = JSON.stringify({
    intent: userData.intent,
    lifestyle: userData.lifestyle,
    colors: userData.colors,
    body: userData.body
  }, null, 2);

  const catalogInfo = JSON.stringify(
    catalog.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      type: p.type,
      primaryColor: p.primary_color,
      style: p.style,
      imageUrl: p.image_url
    })),
    null,
    2
  );

  const systemPrompt = `
Você é a Vênus Engine, uma Inteligência Artificial experta em Consultoria de Imagem, Visagismo e Styling Pessoal Híbrido.
Sua missão é analisar o perfil do usuário B2C e recomendar os melhores "Looks" baseando-se RIGOROSAMENTE nos Catálogos (B2B) providenciados.
Você vai mesclar o acervo do usuário com o catálogo. 

Você deve retornar APENAS UM JSON VÁLIDO obedecendo ESPECIFICAMENTE a seguinte estrutura (Typescript):

{
  "hero": {
    "dominantStyle": "String, Ex: 'Alfaiataria Imponente'",
    "subtitle": "String persuasiva curta"
  },
  "palette": {
    "family": "String da cartela de cores sazonal. Ex: 'Inverno Frio'",
    "description": "String justificando",
    "colors": [ { "hex": "#1A2530", "name": "Navy Noturno" } ], // MÁXIMO 3
    "metal": "Dourado ou Prateado",
    "contrast": "Baixo, Médio ou Alto"
  },
  "diagnostic": {
    "currentPerception": "String descritiva baseada nos gap reportados",
    "desiredGoal": "O que a roupa resolverá",
    "gapSolution": "A chave técnica da solução"
  },
  "bodyVisagism": {
    "shoulders": "Instrução exata",
    "face": "Instrução de decote baseada pro rosto",
    "generalFit": "Corte recomendado"
  },
  "accessories": {
    "scale": "Minimalista, Marcante, Moderada",
    "focalPoint": "Onde deve chamar a atenção",
    "advice": "Regra geral"
  },
  "looks": [
    {
      "id": "1",
      "name": "Upgrade Diário",
      "intention": "Motivação do look",
      "type": "Híbrido Seguro", // Pode ser 'Híbrido Seguro', 'Híbrido Premium' ou 'Expansão Direcionada'
      "items": [
        { "id": "produto_id_ou_mock", "brand": "Marca B2B ou Seu Acervo", "name": "Nome da Peça", "photoUrl": "URL_AQUI" }
      ],
      "accessories": ["Acessório 1", "Acessório 2"],
      "explanation": "Pq funciona pro corpo dela",
      "whenToWear": "Ocasião adequada"
    }
  ],
  "toAvoid": ["Aviso de risco 1", "Aviso de risco 2"]
}

Instruções Extras:
1. Monte 3 Looks EXATAMENTE. Tente sempre incluir ao menos 1 peça do Catálogo B2B fornecido. Se não houver, crie nomes de peças fakes com a marca "Recomendação Genérica".
2. Preencha "photoUrl" com a imagem do catátolo se for o caso. O acervo da pessoa pode vir vazio.
3. Não insira markdown envolvendo o JSON. Responda APENAS o JSON puro.
`;

  // Montagem da mensagem. No futuro, "facePhoto" entra como message content tipo 'image_url'
  // Por enquanto, cruzamos o descritivo de "body photo" apenas como metadado textual
  const userPrompt = `
DADOS DO USUÁRIO OBTIDOS:
${userProfileInfo}

DADOS DA CAPTURA E SCANNER FÍSICO:
Rosto Capturado: ${userData.scanner.facePhoto ? "Foto Enviada (Processar Traços e Contraste)" : "Não Enviado"}
Corpo Capturado: ${userData.scanner.bodyPhoto ? "Foto Enviada (Processar Geometria Arquitetônica)" : "Não Enviado"}

CATÁLOGO APROVADO B2B DA LOJA:
${catalogInfo}

Por favor, gere o Dossiê Visual JSON seguindo as regras e cruze a sua heurística de Visagismo com as opções limitadas da loja de cima.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const responseText = response.choices[0].message.content;

  if (!responseText) {
    throw new Error("OpenAI devolveu vazio.");
  }

  // O parse validará o retorno conforme o formato de ResultPayload
  const payloadData = JSON.parse(responseText) as ResultPayload;

  // Garante injetar fallbacks básicos de coverImage que não vem da LLM
  if (payloadData.hero && !payloadData.hero.coverImageUrl) {
    payloadData.hero.coverImageUrl = ""; 
  }

  return payloadData;
}
