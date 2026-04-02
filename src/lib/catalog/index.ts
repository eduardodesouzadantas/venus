import { createClient } from "@/lib/supabase/server";

export interface Product {
  id: string;
  name: string;
  category: string;
  primary_color: string | null;
  style: string | null;
  type: string;
  price_range: string | null;
  image_url: string | null;
  external_url: string | null;
  created_at: string;
}

export async function getB2BProducts(): Promise<Product[]> {
  // Ignora se env está quebrado dev mode (sem supabase config real)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

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
