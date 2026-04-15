import { ProductEnrichmentForm } from "@/components/catalog/ProductEnrichmentForm";

function formatErrorMessage(error?: string) {
  if (!error) return null;

  if (error === "tenant") {
    return "Sessao invalida ou ausente. Entre novamente para continuar.";
  }

  if (error.startsWith("tenant_blocked:")) {
    const reason = error.split(":")[1] || "";
    if (reason === "kill_switch_on") {
      return "Org com kill switch ativo. Operacao bloqueada.";
    }
    if (reason === "suspended") {
      return "Org suspensa. Operacao bloqueada.";
    }
    if (reason === "blocked") {
      return "Org bloqueada. Operacao bloqueada.";
    }
    return "Tenant sem permissao operacional no momento.";
  }

  if (error.startsWith("hard_cap:")) {
    const metric = error.split(":")[1] || "";
    if (metric === "products") {
      return "Limite server-side do plano atingido para produtos.";
    }
    return "Limite server-side do plano atingido.";
  }

  if (error.startsWith("validation:")) {
    const reason = error.split(":")[1] || "";
    if (reason === "image_missing" || reason === "image_required") {
      return "Envie uma imagem antes de salvar o produto.";
    }
    if (reason === "image_empty") {
      return "A imagem enviada esta vazia.";
    }
    if (reason === "image_too_large") {
      return "A imagem excede o limite de 10MB.";
    }
    if (reason === "image_invalid_type") {
      return "Use uma imagem JPG, PNG ou WEBP.";
    }
    if (reason === "name_required") {
      return "Preencha o nome do produto.";
    }
    if (reason === "primary_color_required") {
      return "Preencha a cor principal.";
    }
    if (reason === "description_required") {
      return "Preencha a descricao base.";
    }
    if (reason === "persuasive_description_required") {
      return "Preencha a descricao persuasiva.";
    }
    if (reason === "emotional_copy_required") {
      return "Preencha a copy emocional.";
    }
    if (reason === "stock_qty_invalid") {
      return "A quantidade de estoque precisa ser um numero valido.";
    }
    if (reason === "reserved_qty_invalid") {
      return "A quantidade reservada precisa ser um numero valido.";
    }
    if (reason === "stock_status_invalid") {
      return "Selecione um status de estoque valido.";
    }
    return "Corrija os dados do produto antes de salvar.";
  }

  return error;
}

export default function ProductNewPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = formatErrorMessage(searchParams?.error);

  return (
    <ProductEnrichmentForm
      title="Novo produto"
      subtitle="Envie a foto da peca, deixe a IA preencher os campos e salve direto no catalogo."
      backHref="/merchant"
      backLabel="Voltar"
      returnTo="/merchant"
      errorMessage={errorMessage}
    />
  );
}
