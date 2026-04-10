import { ProductEnrichmentForm } from "@/components/catalog/ProductEnrichmentForm";

function formatErrorMessage(error?: string) {
  if (!error) return null;

  if (error.startsWith("tenant_blocked:")) {
    const reason = error.split(":")[1] || "";
    if (reason === "kill_switch_on") {
      return "Org com kill switch ativo. Operação bloqueada.";
    }
    if (reason === "suspended") {
      return "Org suspensa. Operação bloqueada.";
    }
    if (reason === "blocked") {
      return "Org bloqueada. Operação bloqueada.";
    }
    return "Tenant sem permissão operacional no momento.";
  }

  if (error.startsWith("hard_cap:")) {
    const metric = error.split(":")[1] || "";
    if (metric === "products") {
      return "Limite server-side do plano atingido para produtos.";
    }
    return "Limite server-side do plano atingido.";
  }

  return error;
}

export default function ProductNewPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = formatErrorMessage(searchParams?.error);

  return (
    <ProductEnrichmentForm
      title="Novo produto"
      subtitle="Envie a foto da peça, deixe a IA preencher os campos e salve direto no catálogo."
      backHref="/merchant"
      backLabel="Voltar"
      returnTo="/merchant"
      errorMessage={errorMessage}
    />
  );
}
