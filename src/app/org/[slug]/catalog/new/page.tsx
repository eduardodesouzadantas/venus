import { ProductEnrichmentForm } from "@/components/catalog/ProductEnrichmentForm";

export default async function NewProductEnrichment({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <ProductEnrichmentForm
      title="Novo produto"
      subtitle="Envie a foto da peça, deixe a IA preencher os campos e salve direto no catálogo da loja."
      backHref={`/org/${slug}/catalog`}
      backLabel="Voltar ao acervo"
      returnTo={`/org/${slug}/catalog`}
    />
  );
}
