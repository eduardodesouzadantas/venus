import { createAdminClient } from "@/lib/supabase/admin";

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

export async function getB2BProducts(orgId?: string | null): Promise<Product[]> {
  try {
    const resolvedOrgId = (orgId || "").trim();
    if (!resolvedOrgId) {
      return [];
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("products")
      .select("*")
      .eq("org_id", resolvedOrgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products", error);
      return [];
    }

    return (data || []) as Product[];
  } catch (err) {
    console.warn("Skipping DB Fetch due to product catalog failure", err);
    return [];
  }
}
