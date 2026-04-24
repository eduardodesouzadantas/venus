import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { buildEnrichmentPatch } from "./catalog-enrichment-helpers";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ORG_ID = "08105310-a61d-40fd-82b9-b9142643867c";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");

  console.log("=".repeat(60));
  console.log("MAISON-ELITE PILOT — ENRICHMENT");
  console.log("=".repeat(60));
  console.log(`Org ID:  ${ORG_ID}`);
  console.log(`Mode:    ${dryRun ? "DRY RUN" : confirm ? "LIVE" : "NO ACTION"}`);
  console.log("");

  console.log("[1/5] Fetching maison-elite products...");
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, category, type, tags, style_direction, occasion_tags, season_tags, formality, stock_status")
    .eq("org_id", ORG_ID)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Fetch error:", error.message);
    return;
  }

  const items = products || [];
  console.log(`  Found ${items.length} products`);
  console.log("");

  console.log("[2/5] Analyzing current state...");
  const alreadyEnriched = items.filter(
    (p) => (p.occasion_tags && p.occasion_tags.length > 0) || p.formality !== "mixed"
  );
  const needsEnrichment = items.filter(
    (p) => !p.occasion_tags || p.occasion_tags.length === 0 || p.formality === "mixed"
  );
  console.log(`  Already enriched: ${alreadyEnriched.length}`);
  console.log(`  Needs enrichment:  ${needsEnrichment.length}`);

  console.log("");
  console.log("[3/5] Building enrichment patches...");
  const patches: { id: string; name: string; patch: ReturnType<typeof buildEnrichmentPatch> }[] = [];
  for (const item of needsEnrichment) {
    const gender = inferGenderFromTags(item.tags);
    const genderFromName = inferGenderFromName(item.name);
    const effectiveGender = gender || genderFromName;

    const masterCategory = inferMasterCategory(item.category, item.type, effectiveGender);
    const usage = inferUsage(item.type, item.category);
    const season = inferSeason(item.tags);

    const patch = buildEnrichmentPatch({
      tags: item.tags,
      gender: effectiveGender,
      masterCategory,
      usage,
      season,
    });
    patches.push({ id: item.id, name: item.name, patch });
  }
  console.log(`  Patches built: ${patches.length}`);
  console.log("");

  console.log("[4/5] DRY RUN — Sample patches:");
  patches.slice(0, 10).forEach(({ name, patch }) => {
    console.log(`  ${name}`);
    console.log(`    style_direction=${patch.style_direction} | occasion=${patch.occasion_tags.join(",")} | season=${patch.season_tags.join(",")} | formality=${patch.formality}`);
  });
  console.log("");

  console.log("[5/5] Summary by style_direction:");
  const byDir: Record<string, number> = { masculine: 0, feminine: 0, neutral: 0 };
  patches.forEach(({ patch }) => { byDir[patch.style_direction as string] = (byDir[patch.style_direction as string] || 0) + 1; });
  Object.entries(byDir).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log("");

  if (dryRun) {
    console.log("DRY RUN COMPLETE — no data written.");
    console.log("Run with --confirm to execute live enrichment.");
    return;
  }

  if (!confirm) {
    console.log("LIVE enrichment paused. Add --confirm to execute.");
    return;
  }

  console.log("[LIVE] Applying patches in batch...");
  const patchesFlat = patches.map(({ id, patch }) => ({ id, ...patch }));
  const batchSize = 50;
  let applied = 0;
  let failed = 0;

  for (let i = 0; i < patchesFlat.length; i += batchSize) {
    const batch = patchesFlat.slice(i, i + batchSize);
    for (const patch of batch) {
      const { error: updateError } = await supabase
        .from("products")
        .update({
          style_direction: patch.style_direction,
          occasion_tags: patch.occasion_tags,
          season_tags: patch.season_tags,
          formality: patch.formality,
          stock_status: patch.stock_status,
          stock_qty: patch.stock_qty,
          reserved_qty: patch.reserved_qty,
        })
        .eq("id", patch.id)
        .eq("org_id", ORG_ID);

      if (updateError) {
        failed++;
        console.error(`  FAIL ${patch.id}: ${updateError.message}`);
      } else {
        applied++;
      }
    }
    process.stdout.write(`  batch ${i}-${Math.min(i + batchSize, patchesFlat.length)} applied\r`);
  }

  console.log("");
  console.log(`ENRICHMENT COMPLETE — applied ${applied}, failed ${failed}`);

  console.log("");
  console.log("Post-enrichment validation:");
  const { data: after } = await supabase
    .from("products")
    .select("id, name, style_direction, occasion_tags, season_tags, formality")
    .eq("org_id", ORG_ID)
    .limit(15);
  (after || []).slice(0, 8).forEach((p) => {
    console.log(`  ${p.name}`);
    console.log(`    sd=${p.style_direction} occ=${JSON.stringify(p.occasion_tags)} sea=${JSON.stringify(p.season_tags)} form=${p.formality}`);
  });
}

function inferGenderFromTags(tags: string[] | null): string | null {
  if (!tags) return null;
  if (tags.includes("men") || tags.includes("masculine") || tags.includes("boys")) return "Men";
  if (tags.includes("women") || tags.includes("feminine") || tags.includes("girls")) return "Women";
  return null;
}

function inferGenderFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes(" men ") || n.includes(" man ") || n.includes(" men's ") || n.includes(" male ")) return "Men";
  if (n.includes(" women ") || n.includes(" woman ") || n.includes(" women's ") || n.includes(" female ")) return "Women";
  return "";
}

function inferMasterCategory(category: string | null, type: string | null, gender: string | null): string {
  if (category === "roupas") return "Apparel";
  if (category === "calcados") return "Footwear";
  if (category === "acessorios") return "Accessories";
  if (category === "cuidado_pessoal") return "Personal Care";
  return "Accessories";
}

function inferUsage(type: string | null, category: string | null): string | null {
  const t = (type || "").toLowerCase();
  const c = (category || "").toLowerCase();
  if (t.includes("formal") || t.includes("tie") || t.includes("blazer") || t.includes("suit")) return "Formal";
  if (t.includes("sports") || t.includes("running") || t.includes("training")) return "Sports";
  if (t.includes("kurta") || t.includes("saree") || t.includes("sherwani") || t.includes("ethnic")) return "Ethnic";
  if (t.includes("party") || t.includes("cocktail")) return "Party";
  if (c === "esporte") return "Sports";
  return "Casual";
}

function inferSeason(tags: string[] | null): string | null {
  if (!tags) return null;
  if (tags.includes("summer")) return "Summer";
  if (tags.includes("winter")) return "Winter";
  if (tags.includes("fall")) return "Fall";
  if (tags.includes("spring")) return "Spring";
  return null;
}

main().catch((e) => { console.error(e); process.exit(1); });