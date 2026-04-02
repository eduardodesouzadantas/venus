"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function createProduct(formData: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Modo local fake
    redirect("/b2b/dashboard");
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/b2b/login")
  }

  const payload = {
    name: formData.get("name"),
    category: formData.get("category"),
    primary_color: formData.get("primary_color"),
    style: formData.get("style"),
    type: formData.get("type"), // 'roupa' | 'acessorio'
    price_range: formData.get("price_range"),
    image_url: formData.get("image_url"),
    external_url: formData.get("external_url"),
    b2b_user_id: user.id
  }

  const { error } = await supabase.from("products").insert([payload])

  if (error) {
    redirect("/b2b/product/new?error=" + error.message)
  }

  revalidatePath("/b2b/dashboard")
  redirect("/b2b/dashboard?created=true")
}
