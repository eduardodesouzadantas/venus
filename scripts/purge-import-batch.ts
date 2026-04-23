import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ORG_ID = "08105310-a61d-40fd-82b9-b9142643867c";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("id")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Fetch error:", error.message);
    return;
  }

  const ids = (data || []).map((p) => p.id);
  console.log(`Deleting ${ids.length} imported items...`);

  const { error: deleteError, count } = await supabase
    .from("products")
    .delete()
    .in("id", ids)
    .select("*", { count: "exact" });

  if (deleteError) {
    console.error("Delete error:", deleteError.message);
    return;
  }

  console.log(`Deleted: ${count} rows`);
  const { count: remaining } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ORG_ID);
  console.log(`Remaining in catalog: ${remaining}`);
}

main().catch(console.error);