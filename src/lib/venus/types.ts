export type VenusIntent =
  | "primeira_mensagem"
  | "curiosidade"
  | "interesse"
  | "objecao"
  | "preco"
  | "compra"
  | "humano"
  | "sumiu";

export type VenusConversationMessage = {
  sender: string;
  text: string;
  created_at?: string | null;
};

export type WardrobeItem = {
  id: string;
  name: string | null;
  category: string | null;
  color: string | null;
  season: string | null;
  image_url: string | null;
  analysis: Record<string, unknown>;
  created_at: string;
};

export type VenusContext = {
  orgId: string;
  orgSlug: string;
  orgName: string;
  clientName: string;
  clientPhone: string;
  archetype: string;
  palette: string;
  fit: string;
  intention: string;
  look: string;
  productName: string;
  productCategory: string;
  productStyle: string;
  productColor: string;
  productSize: string;
  productStock: number;
  stockSummary: string;
  catalogSummary: string;
  history: VenusConversationMessage[];
  state: VenusIntent;
  wardrobe?: WardrobeItem[];
};
