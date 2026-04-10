import { createClient } from "@/lib/supabase/server";
import { resolveCurrentMerchantOrg } from "@/lib/tenant/core";

export interface Product {
  id: string;
  org_id: string | null;
  name: string;
  category: string;
  primary_color: string | null;
  style: string | null;
  type: string;
  price_range: string | null;
  image_url: string | null;
  external_url: string | null;
  created_at: string;
  style_direction?: "Masculina" | "Feminina" | "Neutra" | null;
  style_tags?: string[] | null;
  category_tags?: string[] | null;
  fit_tags?: string[] | null;
  color_tags?: string[] | null;
  target_profile?: string[] | null;
  use_cases?: string[] | null;
  occasion_tags?: string[] | null;
  season_tags?: string[] | null;
  body_effect?: string | null;
  face_effect?: string | null;
  visual_weight?: string | null;
  formality?: string | null;
  catalog_notes?: string | null;
}

export async function getB2BProducts(): Promise<Product[]> {
  // Ignora se env está quebrado dev mode (sem supabase config real)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  try {
    const supabase = await createClient();
    const resolved = await resolveCurrentMerchantOrg(supabase);
    const orgId = resolved.org?.id || null;
    const userId = resolved.user?.id || null;

    let query = supabase.from("products").select("*").order("created_at", { ascending: false });

    if (orgId && userId) {
      // Ponte temporária de migração: org_id é a fonte canônica, b2b_user_id só cobre legado ainda não normalizado.
      query = query.or(`org_id.eq.${orgId},b2b_user_id.eq.${userId}`);
    } else if (orgId) {
      query = query.eq("org_id", orgId);
    } else if (userId) {
      query = query.eq("b2b_user_id", userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching products", error);
      return [];
    }

    return data as Product[];
  } catch (err) {
    console.warn("Skipping DB Fetch due to network layer failure", err);
    return [];
  }
}
