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
  wardrobeSummary: string;
  history: VenusConversationMessage[];
  state: VenusIntent;
};
