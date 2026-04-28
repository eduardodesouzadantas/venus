import * as dotenv from "dotenv";
import { existsSync, readdirSync, readFileSync, createReadStream } from "node:fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { buildEnrichmentPatch } from "./catalog-enrichment-helpers";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ORG_ID = "08105310-a61d-40fd-82b9-b9142643867c";
const ORG_SLUG = "maison-elite";
const DATASET_BASE = path.resolve(process.cwd(), "data/archive/fashion-dataset");
const MIN_SCORE = 75;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Slot targets — derived from docs/maison-showroom-audit.md
const SLOT_TARGETS: Record<string, number> = {
  "Men|top": 120,
  "Men|bottom": 80,
  "Men|layer": 40,
  "Men|shoes": 80,
  "Men|accessory": 50,
  "Women|top": 100,
  "Women|bottom": 60,
  "Women|one_piece": 50,
  "Women|layer": 30,
  "Women|shoes": 70,
  "Women|accessory": 50,
  "Unisex|shoes": 20,
  "Unisex|accessory": 30,
};

const TOTAL_TARGET = Object.values(SLOT_TARGETS).reduce((a, b) => a + b, 0);

const COMBINABLE_COLOURS = new Set([
  "Black", "White", "Blue", "Grey", "Brown", "Navy Blue",
  "Beige", "Cream", "Off White", "Charcoal", "Olive", "Steel",
  "Khaki", "Green", "Red",
]);

const USEFUL_USAGES = new Set([
  "Casual", "Formal", "Smart Casual", "Sports", "Party", "Travel",
]);

// Word-boundary pattern — avoids false positives like "cowboy", "kidnap", "tomboy"
const KIDS_TERMS_PATTERN =
  /\b(kid|kids|boy|boys|girl|girls|junior|infant|toddler|child|children)\b/i;

type SlotName =
  | "top" | "bottom" | "layer" | "one_piece" | "shoes"
  | "accessory" | "underwear_or_excluded" | "beauty_or_excluded" | "unknown";

type StyleRow = {
  id: string;
  gender: string;
  masterCategory: string;
  subCategory: string;
  articleType: string;
  baseColour: string;
  season: string;
  year: string;
  usage: string;
  productDisplayName: string;
};

type ImageRow = { filename: string; link: string };

type JsonEnrichment = {
  brandName?: string;
  ageGroup?: string;
  price?: number;
  discountedPrice?: number;
  articleAttributes?: Record<string, string>;
};

type SelectedItem = { row: StyleRow; slot: SlotName; score: number };
type ExcludedSample = { id: string; name: string; slot: SlotName; reason: string };

// ─── CSV parsing ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}

async function loadStyles(): Promise<StyleRow[]> {
  const filePath = path.join(DATASET_BASE, "styles.csv");
  return new Promise((resolve, reject) => {
    const rows: StyleRow[] = [];
    let headerMap: string[] = [];
    let lineNum = 0;
    createReadStream(filePath, { encoding: "utf8" })
      .on("data", (chunk: string | Buffer) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          if (lineNum === 0) { headerMap = parseCSVLine(line); lineNum++; continue; }
          const values = parseCSVLine(line);
          if (values.length < headerMap.length) continue;
          const raw: Record<string, string> = {};
          headerMap.forEach((h, i) => { raw[h] = values[i] || ""; });
          rows.push(raw as unknown as StyleRow);
          lineNum++;
        }
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function loadImages(): Promise<Map<string, ImageRow>> {
  const filePath = path.join(DATASET_BASE, "images.csv");
  return new Promise((resolve, reject) => {
    const map = new Map<string, ImageRow>();
    let headerMap: string[] = [];
    let lineNum = 0;
    createReadStream(filePath, { encoding: "utf8" })
      .on("data", (chunk: string | Buffer) => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        for (const line of text.split("\n")) {
          if (!line.trim()) continue;
          if (lineNum === 0) { headerMap = parseCSVLine(line); lineNum++; continue; }
          const values = parseCSVLine(line);
          if (values.length < headerMap.length) continue;
          const raw: Record<string, string> = {};
          headerMap.forEach((h, i) => { raw[h] = values[i] || ""; });
          const row = raw as unknown as ImageRow;
          map.set(row.filename.replace(".jpg", ""), row);
          lineNum++;
        }
      })
      .on("end", () => resolve(map))
      .on("error", reject);
  });
}

// ─── Slot classification ──────────────────────────────────────────────────────

function classifySlot(articleType: string, subCat: string, masterCat: string): SlotName {
  const a = (articleType || "").toLowerCase();
  const s = (subCat || "").toLowerCase();
  const m = (masterCat || "").toLowerCase();

  if (m === "footwear") return "shoes";

  if (
    m === "personal care" ||
    s === "fragrance" || s === "skin care" || s === "skin" ||
    s === "hair" || s === "makeup" || s === "lips" || s === "nails" ||
    s === "eyes" || s === "bath and body" || s === "beauty accessories"
  ) return "beauty_or_excluded";

  if (m === "home" || m === "sporting goods" || m === "free items") return "unknown";

  if (m === "accessories") {
    if (a.includes("sock") || a.includes("wristband") || a.includes("shoe accessor")) {
      return "underwear_or_excluded";
    }
    return "accessory";
  }

  // Apparel — check exclusions first
  const isUnderwear =
    a.includes("brief") ||
    a === "trunks" || a === "trunk" ||
    a === "bra" ||
    a.includes("innerwear vest") ||
    a.includes("lingerie") ||
    a.includes("sock") ||
    a.includes("nightdress") ||
    a.includes("night suit") ||
    a.includes("swimwear") ||
    a.includes("swim") ||
    s === "innerwear" || s.startsWith("innerwear") ||
    s === "loungewear and nightwear" ||
    s === "socks";
  if (isUnderwear) return "underwear_or_excluded";

  // Layer before top — jackets/coats/sweaters win over topwear subcat
  if (
    a.includes("jacket") || a.includes("blazer") || a.includes("coat") ||
    a.includes("waistcoat") || a.includes("cardigan") || a.includes("sweater") ||
    a.includes("sweatshirt") || a.includes("hoodie") || a.includes("shrug") ||
    a.includes("poncho") || a.includes("cape")
  ) return "layer";

  // One-piece
  if (
    a.includes("dress") || a.includes("saree") || a.includes("apparel set") ||
    a.includes("jumpsuit") || a.includes("romper") || a.includes("dungaree") ||
    s === "dress" || s === "saree"
  ) return "one_piece";

  // Top
  if (
    s === "topwear" ||
    a.includes("tshirt") || a.includes("t-shirt") ||
    a.includes("shirt") || a === "tops" ||
    a.includes("kurta") || a.includes("kurti") ||
    a.includes("blouse") || a.includes("tunic") || a.includes("top") ||
    a.includes("polo")
  ) return "top";

  // Bottom
  if (
    s === "bottomwear" ||
    a.includes("jean") || a.includes("trouser") || a.includes("short") ||
    a.includes("capri") || a.includes("skirt") || a.includes("legging") ||
    a.includes("track pant") || a.includes("pant")
  ) return "bottom";

  return "unknown";
}

// ─── Quality score ────────────────────────────────────────────────────────────

function qualityScore(row: StyleRow, slot: SlotName, hasLocalImage: boolean): number {
  let score = 0;
  if (hasLocalImage) score += 20;
  if (row.productDisplayName.length > 5 && row.productDisplayName.length < 100) score += 10;
  if (row.masterCategory && row.subCategory && row.articleType) score += 10;
  if (["top", "bottom", "layer", "one_piece", "shoes"].includes(slot)) score += 25;
  else if (slot === "accessory") score += 10;
  if (COMBINABLE_COLOURS.has(row.baseColour)) score += 15;
  if (USEFUL_USAGES.has(row.usage)) score += 10;
  if (row.gender === "Men" || row.gender === "Women") score += 5;
  if (row.gender === "Boys" || row.gender === "Girls") score -= 10;
  if (slot === "underwear_or_excluded" || slot === "beauty_or_excluded") score -= 30;
  if (slot === "unknown") score -= 15;
  return Math.max(0, Math.min(100, score));
}

// ─── Kids detection ───────────────────────────────────────────────────────────

function isKidsItem(row: StyleRow, json: JsonEnrichment | null): boolean {
  if (row.gender === "Boys" || row.gender === "Girls") return true;
  const textsToCheck = [
    row.productDisplayName,
    row.articleType,
    row.subCategory,
    json?.ageGroup ?? "",
  ];
  return textsToCheck.some(text => text && KIDS_TERMS_PATTERN.test(text));
}

// ─── JSON enrichment ──────────────────────────────────────────────────────────

function loadJsonEnrichment(id: string): JsonEnrichment | null {
  const filePath = path.join(DATASET_BASE, "styles", `${id}.json`);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    const d = raw?.data ?? raw;
    return {
      brandName: typeof d.brandName === "string" ? d.brandName : undefined,
      ageGroup: typeof d.ageGroup === "string" ? d.ageGroup : undefined,
      price: typeof d.price === "number" ? d.price : undefined,
      discountedPrice: typeof d.discountedPrice === "number" ? d.discountedPrice : undefined,
      articleAttributes:
        d.articleAttributes && typeof d.articleAttributes === "object"
          ? (d.articleAttributes as Record<string, string>)
          : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Showroom batch selection ─────────────────────────────────────────────────

function selectShowroomBatch(
  rows: StyleRow[],
  localImageSet: Set<string>,
): { selected: SelectedItem[]; excluded: ExcludedSample[]; excludedCounts: Record<string, number> } {
  const excludedSamples: ExcludedSample[] = [];
  const excludedCounts: Record<string, number> = {};

  function recordExclusion(row: StyleRow, slot: SlotName, reason: string, bucket: string) {
    excludedCounts[bucket] = (excludedCounts[bucket] ?? 0) + 1;
    if ((excludedCounts[bucket] ?? 0) <= 4) {
      excludedSamples.push({ id: row.id, name: row.productDisplayName, slot, reason });
    }
  }

  // Score and pre-filter every row
  const candidates: SelectedItem[] = [];
  for (const row of rows) {
    const slot = classifySlot(row.articleType, row.subCategory, row.masterCategory);
    const hasImg = localImageSet.has(row.id);
    const score = qualityScore(row, slot, hasImg);

    if (!hasImg) { recordExclusion(row, slot, "no local image", "no_image"); continue; }
    if (score < MIN_SCORE) { recordExclusion(row, slot, `score ${score} < ${MIN_SCORE}`, "low_score"); continue; }
    if (slot === "underwear_or_excluded") { recordExclusion(row, slot, `underwear/sleepwear: ${row.articleType}`, "underwear"); continue; }
    if (slot === "beauty_or_excluded") { recordExclusion(row, slot, `beauty/personal care: ${row.articleType}`, "beauty"); continue; }
    if (slot === "unknown") { recordExclusion(row, slot, `unclassifiable: ${row.masterCategory}/${row.articleType}`, "unknown"); continue; }
    if (isKidsItem(row, null)) {
      const reason = (row.gender === "Boys" || row.gender === "Girls")
        ? `kids gender (${row.gender})`
        : `kids text match: "${row.productDisplayName.substring(0, 40)}"`;
      recordExclusion(row, slot, reason, "kids");
      continue;
    }

    candidates.push({ row, slot, score });
  }

  // Sort by score descending — top-quality items fill buckets first
  candidates.sort((a, b) => b.score - a.score);

  const bucketFill: Record<string, number> = {};
  const seenNames = new Set<string>();
  const selected: SelectedItem[] = [];

  for (const item of candidates) {
    // Women|one_piece: exclude ethnic items (sarees dominate)
    if (item.slot === "one_piece" && item.row.gender === "Women" && item.row.usage === "Ethnic") continue;

    const key = `${item.row.gender}|${item.slot}`;
    const target = SLOT_TARGETS[key];
    if (!target) continue; // gender/slot combo not in showroom plan

    if ((bucketFill[key] ?? 0) >= target) continue;

    const nameLower = item.row.productDisplayName.toLowerCase();
    if (seenNames.has(nameLower)) continue;
    seenNames.add(nameLower);

    selected.push(item);
    bucketFill[key] = (bucketFill[key] ?? 0) + 1;
  }

  return { selected, excluded: excludedSamples, excludedCounts };
}

// ─── Product mapping ──────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  Apparel: "roupas",
  Accessories: "acessorios",
  Footwear: "calcados",
  "Personal Care": "cuidado_pessoal",
  "Sporting Goods": "esporte",
};

function mapToProduct(
  row: StyleRow,
  imageMap: Map<string, ImageRow>,
  json: JsonEnrichment | null,
  slot: SlotName,
): Record<string, unknown> {
  const img = imageMap.get(row.id);
  const enrichment = buildEnrichmentPatch({
    tags: null,
    gender: row.gender,
    masterCategory: row.masterCategory,
    usage: row.usage,
    season: row.season,
  });

  const attrs = json?.articleAttributes ?? {};
  const heroEligible = ["top", "bottom", "layer", "one_piece", "shoes"].includes(slot);

  // Pack all tag signals into `tags` (available column)
  // category_tags / style_tags / fit_tags / color_tags are stored in catalog_notes
  const tags = [
    row.usage.toLowerCase(),
    row.season.toLowerCase(),
    slot,
    enrichment.style_direction,
    row.masterCategory.toLowerCase(),
    row.subCategory.toLowerCase(),
    attrs["Pattern"]?.toLowerCase(),
    (attrs["Fabric"] ?? attrs["Material"])?.toLowerCase(),
    attrs["Fit"]?.toLowerCase(),
    row.baseColour.toLowerCase(),
  ].filter((t): t is string => typeof t === "string" && t.length > 0);

  const targetProfile =
    row.gender === "Unisex"
      ? ["masculine", "feminine"]
      : enrichment.style_direction === "masculine"
        ? ["masculine"]
        : ["feminine"];

  const catalogNotes = JSON.stringify({
    slot,
    hero: heroEligible,
    tryon: heroEligible,
    dataset_id: row.id,
    brand: json?.brandName ?? null,
    age_group: json?.ageGroup ?? null,
    category_tags: [row.masterCategory, row.subCategory].filter(Boolean),
    style_tags: [slot, attrs["Pattern"], attrs["Fabric"] ?? attrs["Material"]].filter(Boolean),
    fit_tags: [attrs["Fit"], attrs["Sleeve Styling"] ?? attrs["Sleeve Length"], attrs["Type"]].filter(Boolean),
    color_tags: [row.baseColour, attrs["Colour"] ?? attrs["Color"]].filter(Boolean),
    attributes: Object.keys(attrs).length > 0 ? attrs : undefined,
  });

  return {
    org_id: ORG_ID,
    name: row.productDisplayName,
    category: CATEGORY_MAP[row.masterCategory] ?? row.masterCategory.toLowerCase(),
    type: row.articleType,
    primary_color: row.baseColour,
    style: row.subCategory,
    image_url: img?.link ?? null,
    external_url: img?.link ?? null,
    tags,
    size_type: "unisex",
    style_direction: enrichment.style_direction,
    target_profile: targetProfile,
    occasion_tags: enrichment.occasion_tags,
    season_tags: enrichment.season_tags,
    formality: enrichment.formality,
    visual_weight: heroEligible ? "medium" : "light",
    body_effect: null,
    face_effect: null,
    stock_status: enrichment.stock_status,
    stock_qty: enrichment.stock_qty,
    reserved_qty: enrichment.reserved_qty,
    catalog_notes: catalogNotes,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");

  console.log("=".repeat(60));
  console.log("MAISON-ELITE — SHOWROOM SLOT-BALANCED IMPORT");
  console.log("=".repeat(60));
  console.log(`Org ID:     ${ORG_ID}`);
  console.log(`Org Slug:   ${ORG_SLUG}`);
  console.log(`Mode:       ${dryRun ? "DRY RUN" : confirm ? "LIVE — CONFIRM" : "LIVE (add --confirm to execute)"}`);
  console.log(`Min Score:  ${MIN_SCORE}`);
  console.log(`Target:     ${TOTAL_TARGET} items across ${Object.keys(SLOT_TARGETS).length} slot/gender buckets`);
  console.log("");

  // 1. Load CSV data
  console.log("[1/7] Loading styles.csv ...");
  const styles = await loadStyles();
  console.log(`  ${styles.length} rows loaded`);

  console.log("[2/7] Loading images.csv ...");
  const imageMap = await loadImages();
  console.log(`  ${imageMap.size} image entries loaded`);

  // 2. Build local image index
  console.log("[3/7] Building local image index ...");
  const imagesDir = path.join(DATASET_BASE, "images");
  const localImageSet = new Set<string>(
    existsSync(imagesDir)
      ? readdirSync(imagesDir).map(f => f.replace(".jpg", ""))
      : [],
  );
  console.log(`  ${localImageSet.size} local images indexed`);

  // 3. Score + select batch
  console.log("[4/7] Selecting showroom batch (slot-balanced, score >= " + MIN_SCORE + ") ...");
  const { selected, excluded, excludedCounts } = selectShowroomBatch(styles, localImageSet);

  // Distribution report
  const slotDist: Record<string, number> = {};
  const genderDist: Record<string, number> = {};
  let scoreSum = 0;
  let scoreMin = 100;
  for (const item of selected) {
    const key = `${item.row.gender}|${item.slot}`;
    slotDist[key] = (slotDist[key] ?? 0) + 1;
    genderDist[item.row.gender] = (genderDist[item.row.gender] ?? 0) + 1;
    scoreSum += item.score;
    if (item.score < scoreMin) scoreMin = item.score;
  }
  const avgScore = selected.length ? (scoreSum / selected.length).toFixed(1) : "n/a";

  console.log("");
  console.log("  SLOT DISTRIBUTION:");
  for (const [key, target] of Object.entries(SLOT_TARGETS).sort()) {
    const count = slotDist[key] ?? 0;
    const pct = Math.round((count / target) * 100);
    const bar = "█".repeat(Math.round(pct / 10)).padEnd(10, "░");
    console.log(`  ${key.padEnd(24)} ${String(count).padStart(4)} / ${target}  ${bar} ${pct}%`);
  }
  console.log("");
  console.log("  GENDER DISTRIBUTION:");
  for (const [g, count] of Object.entries(genderDist).sort()) {
    console.log(`    ${g.padEnd(10)} ${count}`);
  }
  console.log("");
  console.log(`  SCORE — avg: ${avgScore}  min: ${scoreMin}  threshold: ${MIN_SCORE}`);
  console.log(`  TOTAL SELECTED: ${selected.length}`);

  console.log("");
  console.log("  EXCLUSION COUNTS:");
  for (const [reason, count] of Object.entries(excludedCounts).sort()) {
    console.log(`    ${reason.padEnd(20)} ${count}`);
  }

  // 4. Load JSON enrichment for selected items only
  console.log("");
  console.log("[5/7] Loading JSON enrichment for selected items ...");
  const jsonMap = new Map<string, JsonEnrichment | null>();
  let jsonHits = 0;
  for (const item of selected) {
    const json = loadJsonEnrichment(item.row.id);
    jsonMap.set(item.row.id, json);
    if (json) jsonHits++;
  }
  console.log(`  JSON enriched: ${jsonHits} / ${selected.length}`);

  // Post-filter: catch any remaining kids items surfaced by ageGroup in JSON
  const kidsLeaked = selected.filter(item => isKidsItem(item.row, jsonMap.get(item.row.id) ?? null));
  if (kidsLeaked.length > 0) {
    console.log(`  Post-filter removed ${kidsLeaked.length} kids item(s) caught via JSON ageGroup:`);
    for (const item of kidsLeaked) {
      const json = jsonMap.get(item.row.id);
      console.log(`    [${item.row.gender}|${item.slot}] ${item.row.productDisplayName} (ageGroup=${json?.ageGroup ?? "n/a"})`);
    }
  }
  const kidsLeakedIds = new Set(kidsLeaked.map(i => i.row.id));
  const finalSelected = selected.filter(item => !kidsLeakedIds.has(item.row.id));
  if (kidsLeaked.length > 0) {
    console.log(`  Final selected after post-filter: ${finalSelected.length}`);
  }

  // 5. Sample items per slot
  console.log("");
  console.log("[6/7] Sample items per slot:");
  const shownKeys = new Set<string>();
  for (const item of finalSelected) {
    const key = `${item.row.gender}|${item.slot}`;
    if (shownKeys.has(key)) continue;
    shownKeys.add(key);
    const json = jsonMap.get(item.row.id);
    console.log(`  [${key}]`);
    console.log(`    ${item.row.productDisplayName}`);
    console.log(`    score=${item.score} | color=${item.row.baseColour} | usage=${item.row.usage} | brand=${json?.brandName ?? "n/a"}`);
  }
  console.log("");
  console.log("  EXCLUDED SAMPLES:");
  for (const ex of excluded.slice(0, 12)) {
    console.log(`    [${ex.slot}] ${ex.name.substring(0, 55)} — ${ex.reason}`);
  }

  // 6. Build product objects
  console.log("");
  console.log("[7/7] Building product objects ...");
  const products = finalSelected.map(item =>
    mapToProduct(item.row, imageMap, jsonMap.get(item.row.id) ?? null, item.slot),
  );
  const withImage = products.filter(p => p.image_url).length;
  console.log(`  ${products.length} products built  (${withImage} with image_url)`);

  // ── DRY RUN ────────────────────────────────────────────────────────────────
  if (dryRun) {
    console.log("");
    console.log("DRY RUN COMPLETE — no data written.");
    console.log(`Run with --confirm to insert up to ${products.length} items into ${ORG_SLUG}.`);
    return;
  }

  if (!confirm) {
    console.log("");
    console.log("LIVE import paused — add --confirm to execute.");
    return;
  }

  // ── LIVE IMPORT ────────────────────────────────────────────────────────────
  console.log("");
  console.log("[LIVE] Checking for existing products in org ...");
  const { data: existing, error: fetchErr } = await supabase
    .from("products")
    .select("name")
    .eq("org_id", ORG_ID);

  if (fetchErr) {
    console.error("Failed to fetch existing products:", fetchErr.message);
    process.exit(1);
  }

  const existingNames = new Set(
    (existing ?? []).map((p: { name: string }) => p.name.toLowerCase()),
  );
  const newProducts = products.filter(
    p => !existingNames.has(String(p.name).toLowerCase()),
  );
  const skipped = products.length - newProducts.length;

  console.log(`  Existing in org: ${existingNames.size}`);
  console.log(`  To insert:       ${newProducts.length}`);
  console.log(`  Skipped (dupe):  ${skipped}`);

  if (newProducts.length === 0) {
    console.log("  Nothing to insert — all selected items already exist in catalog.");
    return;
  }

  console.log("");
  console.log("[LIVE] Inserting in batches of 100 ...");
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
    const batch = newProducts.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase
      .from("products")
      .insert(batch)
      .select("id, name");

    if (error) {
      console.error(`\nINSERT ERROR (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message);
      process.exit(1);
    }

    inserted += data?.length ?? 0;
    process.stdout.write(`\r  Inserted: ${inserted} / ${newProducts.length}`);
  }

  console.log("");
  console.log("");

  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ORG_ID);

  console.log(`SUCCESS — inserted ${inserted} products.`);
  console.log(`Total products in ${ORG_SLUG} catalog: ${count}`);
}

main().catch(err => { console.error(err); process.exit(1); });
