// Safe by default: runs as dry-run unless --confirm is provided.
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
  const isConfirm = process.argv.includes("--confirm");
  const isDryRun = process.argv.includes("--dry-run") || !isConfirm;

  console.log("Fixing tag classification in maison-elite catalog...\n");
  console.log(
    isDryRun
      ? "DRY RUN: no database changes will be made."
      : "CONFIRM MODE: database updates will be applied."
  );
  console.log("");

  const { data: allProducts, error } = await supabase
    .from("products")
    .select("id, name, category, type, tags, primary_color")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Fetch error:", error.message);
    return;
  }

  const items = allProducts || [];

  const accessories = items.filter(
    (p) => p.category === "acessorios" || p.category === "cuidado_pessoal"
  );
  const wronglyTagged = accessories.filter(
    (p) => p.tags?.includes("masculine") || p.tags?.includes("feminine")
  );
  const correctlyTaggedNeutral = accessories.filter((p) =>
    p.tags?.includes("neutral")
  );

  console.log("DIAGNOSIS:");
  console.log(`  Total imported:  ${items.length}`);
  console.log(`  Accessories total: ${accessories.length}`);
  console.log(`  WRONG tags (masculine/feminine): ${wronglyTagged.length}`);
  console.log(`  Correct tags (neutral):          ${correctlyTaggedNeutral.length}`);
  console.log("");

  if (wronglyTagged.length === 0) {
    console.log("No corrections needed.");
    return;
  }

  const newTags = ["neutral", "unisex", "casual"];

  if (isDryRun) {
    console.log(`Would update ${wronglyTagged.length} item(s) to tags: [${newTags.join(", ")}]`);
    console.log("");
    console.log("Items that would be corrected:");
    wronglyTagged.slice(0, 10).forEach((p) => {
      console.log(`  ${p.name} | ${p.type} | ${p.category} | current tags: ${(p.tags || []).join(", ")}`);
    });
    if (wronglyTagged.length > 10) {
      console.log(`  ... and ${wronglyTagged.length - 10} more.`);
    }
    console.log("");
    console.log("To apply changes run:");
    console.log("  npx tsx scripts/fix-catalog-tags.ts --confirm");
    return;
  }

  // CONFIRM mode — execute UPDATE
  const ids = wronglyTagged.map((p) => p.id);
  console.log(`Updating ${ids.length} items to neutral...`);

  const { data: updated, error: updateError } = await supabase
    .from("products")
    .update({ tags: newTags })
    .in("id", ids)
    .select("id, name, category, type");

  if (updateError) {
    console.error("UPDATE ERROR:", updateError.message);
    return;
  }

  console.log(`SUCCESS — corrected ${updated?.length ?? 0} items.`);
  console.log("");
  console.log("Sample corrected items:");
  (updated || []).slice(0, 10).forEach((p) => {
    console.log(`  ${p.name} | ${p.type} | ${p.category}`);
  });

  const { data: after } = await supabase
    .from("products")
    .select("id, category, tags")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false })
    .limit(300);

  const afterItems = after || [];
  const masc = afterItems.filter((p) => p.tags?.includes("masculine"));
  const fem = afterItems.filter((p) => p.tags?.includes("feminine"));
  const neut = afterItems.filter((p) => p.tags?.includes("neutral"));
  const rouMasc = afterItems.filter(
    (p) => p.category === "roupas" && p.tags?.includes("masculine")
  );
  const rouFem = afterItems.filter(
    (p) => p.category === "roupas" && p.tags?.includes("feminine")
  );
  const accNeut = afterItems.filter(
    (p) => p.category === "acessorios" && p.tags?.includes("neutral")
  );

  console.log("");
  console.log("AFTER correction — VALIDATION:");
  console.log(
    `  Masculine (roupas/calcados):  ${masc.length} (roupas: ${rouMasc.length})`
  );
  console.log(
    `  Feminine  (roupas/calcados):  ${fem.length} (roupas: ${rouFem.length})`
  );
  console.log(`  Neutral   (acessorios):    ${neut.length} (acc: ${accNeut.length})`);
  console.log(
    `  TOTAL:                        ${masc.length + fem.length + neut.length}`
  );
}

main().catch(console.error);
