export interface MerchantBenefitItem {
  title: string;
  description: string;
  unlock: string;
}

export interface MerchantBenefitProgram {
  headline: string;
  intro: string;
  cta: string;
  benefits: MerchantBenefitItem[];
}

const DEFAULT_STORE = "Venus Engine";
const STORAGE_PREFIX = "venus_merchant_benefit_program_v1";

const DEFAULT_PROGRAM: MerchantBenefitProgram = {
  headline: "Benefícios desbloqueados pela loja",
  intro: "Ao postar, o cliente já vê quais vantagens a loja libera e por que vale mostrar a leitura.",
  cta: "Marque a loja e @InovaCortex ao publicar.",
  benefits: [
    {
      title: "Atendimento prioritário",
      description: "A loja responde primeiro quem compartilha a leitura e mostra intenção real.",
      unlock: "Postou o look",
    },
    {
      title: "Acesso antecipado",
      description: "Drops e novidades chegam antes para quem participa da experiência.",
      unlock: "Compartilhou a imagem",
    },
    {
      title: "Benefício VIP",
      description: "Um gesto comercial definido pelo lojista para transformar engajamento em venda.",
      unlock: "Desbloqueio comercial",
    },
  ],
};

export const DEFAULT_MERCHANT_BENEFIT_PROGRAM = DEFAULT_PROGRAM;

const hasWindow = () => typeof window !== "undefined";

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase()
    .trim() || "maisonelite";

const storageKey = (storeName?: string) => `${STORAGE_PREFIX}:${normalizeKey(storeName || DEFAULT_STORE)}`;

const parseJSON = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const normalizeBenefit = (benefit?: Partial<MerchantBenefitItem> | null): MerchantBenefitItem => ({
  title: (benefit?.title || "").trim() || "Benefício da loja",
  description: (benefit?.description || "").trim() || "Descreva aqui o benefício que a loja quer liberar.",
  unlock: (benefit?.unlock || "").trim() || "Quando o cliente postar",
});

export function readMerchantBenefitProgram(storeName?: string): MerchantBenefitProgram {
  if (!hasWindow()) return DEFAULT_PROGRAM;

  const raw = parseJSON<Partial<MerchantBenefitProgram>>(window.localStorage.getItem(storageKey(storeName)));
  const benefits = [0, 1, 2].map((index) => normalizeBenefit(raw?.benefits?.[index] ?? DEFAULT_PROGRAM.benefits[index]));

  return {
    ...DEFAULT_PROGRAM,
    ...raw,
    headline: (raw?.headline || DEFAULT_PROGRAM.headline).trim() || DEFAULT_PROGRAM.headline,
    intro: (raw?.intro || DEFAULT_PROGRAM.intro).trim() || DEFAULT_PROGRAM.intro,
    cta: (raw?.cta || DEFAULT_PROGRAM.cta).trim() || DEFAULT_PROGRAM.cta,
    benefits,
  };
}

export function writeMerchantBenefitProgram(storeName: string | undefined, next: Partial<MerchantBenefitProgram>) {
  if (!hasWindow()) return DEFAULT_PROGRAM;

  const current = readMerchantBenefitProgram(storeName);
  const benefits = [0, 1, 2].map((index) => normalizeBenefit(next.benefits?.[index] ?? current.benefits[index]));
  const value: MerchantBenefitProgram = {
    ...current,
    ...next,
    headline: (next.headline || current.headline).trim() || DEFAULT_PROGRAM.headline,
    intro: (next.intro || current.intro).trim() || DEFAULT_PROGRAM.intro,
    cta: (next.cta || current.cta).trim() || DEFAULT_PROGRAM.cta,
    benefits,
  };

  window.localStorage.setItem(storageKey(storeName), JSON.stringify(value));
  return value;
}

export function getMerchantBenefitSummary(storeName?: string) {
  return readMerchantBenefitProgram(storeName).benefits.map((benefit) => benefit.title).filter(Boolean);
}
