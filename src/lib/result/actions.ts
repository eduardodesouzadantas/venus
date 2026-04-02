"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateB2CResult(formData: FormData, dbResultId: string) {
  const supabase = await createClient()

  // Neste fluxo robusto, não salvamos mais nada novo, damos "UPDATE" 
  // atrelando o E-mail de Lead do cliente à linha de banco recém renderizada por ele.
  const email = formData.get("email") as string
  const name = formData.get("name") as string

  if (!email || !dbResultId) {
    return { error: "E-mail ou Token de Dossiê não encontrado." }
  }

  const { error } = await supabase.from("saved_results")
      .update({ user_email: email, user_name: name })
      .eq("id", dbResultId);

  if (error) {
    return { error: "Erro ao salvar Perfil: " + error.message }
  }

  // Redireciona de volta com mensagem de sucesso apontando para a mesma hash
  redirect(`/result?id=${dbResultId}&saved=true`)
}
