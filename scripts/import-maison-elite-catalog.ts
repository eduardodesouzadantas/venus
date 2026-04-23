import * as dotenv from "dotenv";
import { existsSync, createReadStream } from "node:fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const ORG_ID = "08105310-a61d-40fd-82b9-b9142643867c";
const ORG_SLUG = "maison-elite";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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

type ImageRow = {
  filename: string;
  link: string;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function loadStyles(): Promise<StyleRow[]> {
  const filePath = "C:\\Users\\QuasarUser\\Downloads\\archive\\fashion-dataset\\styles.csv";
  return new Promise((resolve, reject) => {
    const rows: StyleRow[] = [];
    let headerMap: string[] = [];
    let lineNum = 0;
    createReadStream(filePath, { encoding: "utf8" })
      .on("data", (chunk: string) => {
        const lines = chunk.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          if (lineNum === 0) {
            headerMap = parseCSVLine(line);
            lineNum++;
            continue;
          }
          const values = parseCSVLine(line);
          if (values.length < headerMap.length) continue;
          const row: Record<string, string> = {};
          headerMap.forEach((h, idx) => { row[h] = values[idx] || ""; });
          rows.push(row as unknown as StyleRow);
          lineNum++;
        }
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

async function loadImages(): Promise<Map<string, ImageRow>> {
  const filePath = "C:\\Users\\QuasarUser\\Downloads\\archive\\fashion-dataset\\images.csv";
  return new Promise((resolve, reject) => {
    const map = new Map<string, ImageRow>();
    let headerMap: string[] = [];
    let lineNum = 0;
    createReadStream(filePath, { encoding: "utf8" })
      .on("data", (chunk: string) => {
        const lines = chunk.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          if (lineNum === 0) {
            headerMap = parseCSVLine(line);
            lineNum++;
            continue;
          }
          const values = parseCSVLine(line);
          if (values.length < headerMap.length) continue;
          const row: Record<string, string> = {};
          headerMap.forEach((h, idx) => { row[h] = values[idx] || ""; });
          const imgRow = row as unknown as ImageRow;
          const id = imgRow.filename.replace(".jpg", "");
          map.set(id, imgRow);
          lineNum++;
        }
      })
      .on("end", () => resolve(map))
      .on("error", reject);
  });
}

function selectPilot(items: StyleRow[], imageMap: Map<string, ImageRow>, target: number, opts: { gender?: string; masterCategory?: string }): StyleRow[] {
  const candidates = items.filter(item => {
    if (opts.gender && item.gender !== opts.gender) return false;
    if (opts.masterCategory && item.masterCategory !== opts.masterCategory) return false;
    return true;
  });
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selected: StyleRow[] = [];
  const seenNames = new Set<string>();

  for (const item of shuffled) {
    if (selected.length >= target) break;
    const name = item.productDisplayName.toLowerCase();
    if (seenNames.has(name)) continue;
    const img = imageMap.get(item.id);
    if (!img || !img.link || img.link.length < 10) continue;
    seenNames.add(name);
    selected.push(item);
  }
  return selected;
}

function isApparelCategory(masterCategory: string): boolean {
  return masterCategory === "Apparel";
}

function isFootwearCategory(masterCategory: string): boolean {
  return masterCategory === "Footwear";
}

function determineStyleDirection(row: StyleRow): string {
  const { gender, masterCategory, articleType } = row;

  if (!isApparelCategory(masterCategory) && !isFootwearCategory(masterCategory)) {
    return "neutral";
  }
  return gender === "Men" ? "masculine" : gender === "Women" ? "feminine" : "neutral";
}

function mapToProduct(row: StyleRow, imageMap: Map<string, ImageRow>): Record<string, unknown> {
  const img = imageMap.get(row.id);
  const styleDirection = determineStyleDirection(row);
  const isApparelOrFootwear = isApparelCategory(row.masterCategory) || isFootwearCategory(row.masterCategory);

  const categoryMap: Record<string, string> = {
    Apparel: "roupas",
    Accessories: "acessorios",
    Footwear: "calcados",
    "Personal Care": "cuidado_pessoal",
    "Sporting Goods": "esporte",
  };

  const usage = row.usage.toLowerCase();
  const season = row.season.toLowerCase();
  const tags: string[] = [
    usage,
    season,
    row.articleType.toLowerCase(),
    styleDirection,
  ];
  if (!isApparelOrFootwear) {
    tags.push(row.masterCategory.toLowerCase());
  }

  const occasionTags: string[] = [usage];
  const seasonTags: string[] = [season];

  return {
    org_id: ORG_ID,
    name: row.productDisplayName,
    category: categoryMap[row.masterCategory] || row.masterCategory.toLowerCase(),
    type: row.articleType,
    primary_color: row.baseColour,
    style: row.subCategory,
    image_url: img?.link || null,
    external_url: img?.link || null,
    tags,
    size_type: "unisex",
    style_direction: styleDirection,
    occasion_tags: occasionTags,
    season_tags: seasonTags,
    formality: usage === "casual" ? "casual" : usage === "formal" ? "formal" : "mixed",
    stock_status: "in_stock",
    stock_qty: 10,
    reserved_qty: 0,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");

  console.log("=".repeat(60));
  console.log("MAISON-ELITE CATALOG IMPORT — PILOT BATCH");
  console.log("=".repeat(60));
  console.log(`Org ID:     ${ORG_ID}`);
  console.log(`Org Slug:   ${ORG_SLUG}`);
  console.log(`Mode:       ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log("");

  console.log("[1/6] Loading styles.csv ...");
  const styles = await loadStyles();
  console.log(`  Loaded ${styles.length} rows`);

  console.log("[2/6] Loading images.csv ...");
  const imageMap = await loadImages();
  console.log(`  Loaded ${imageMap.size} image links`);

  const mensApparel = styles.filter(r => r.gender === "Men" && r.masterCategory === "Apparel");
  const womensApparel = styles.filter(r => r.gender === "Women" && r.masterCategory === "Apparel");
  const accessories = styles.filter(r => r.masterCategory === "Accessories");

  console.log("[3/6] Selecting pilot batch (100 each, semantic) ...");
  console.log(`  Candidates — Masculinos (Apparel): ${mensApparel.length}`);
  console.log(`  Candidates — Femininos (Apparel): ${womensApparel.length}`);
  console.log(`  Candidates — Acessorios (Accessories): ${accessories.length}`);

  const mensSample = selectPilot(styles, imageMap, 100, { gender: "Men", masterCategory: "Apparel" });
  const womensSample = selectPilot(styles, imageMap, 100, { gender: "Women", masterCategory: "Apparel" });
  const accessoriesSample = selectPilot(styles, imageMap, 100, { masterCategory: "Accessories" });

  console.log("SELECTION SUMMARY:");
  console.log(`  Masculinos (Apparel):  ${mensSample.length} selected (from ${mensApparel.length} candidates)`);
  console.log(`  Femininos (Apparel):   ${womensSample.length} selected (from ${womensApparel.length} candidates)`);
  console.log(`  Acessorios (Accessories): ${accessoriesSample.length} selected (from ${accessories.length} candidates)`);
  console.log(`  TOTAL:       ${mensSample.length + womensSample.length + accessoriesSample.length}`);
  console.log("");

  console.log("[4/6] Mapping to product schema ...");
  const allItems = [...mensSample, ...womensSample, ...accessoriesSample];
  const products = allItems.map(r => mapToProduct(r, imageMap));

  const withImage = products.filter(p => p.image_url);
  console.log(`  Products with image: ${withImage.length} / ${products.length}`);
  console.log("");

  console.log("[5/6] DRY RUN EVIDENCE — Sample items:");
  console.log("");
  const samples = [
    ...mensSample.slice(0, 3),
    ...womensSample.slice(0, 3),
    ...accessoriesSample.slice(0, 3),
  ];
  for (const s of samples) {
    const img = imageMap.get(s.id);
    console.log(`  [${s.gender}] ${s.productDisplayName}`);
    console.log(`    type=${s.articleType} | color=${s.baseColour} | usage=${s.usage}`);
    console.log(`    img=${img?.link?.substring(0, 70) ?? "MISSING"}...`);
    console.log("");
  }

  console.log("[6/6] Field mapping reference:");
  console.log("  styles.gender            -> product.style_direction (masculine/feminine/neutral)");
  console.log("  styles.masterCategory    -> product.category");
  console.log("  styles.articleType       -> product.type");
  console.log("  styles.baseColour        -> product.primary_color");
  console.log("  styles.subCategory       -> product.style");
  console.log("  styles.productDisplayName-> product.name");
  console.log("  styles.usage             -> product.occasion_tags[] + formality");
  console.log("  styles.season            -> product.season_tags[]");
  console.log("  images.link              -> product.image_url + external_url");
  console.log("  computed                 -> product.stock_status + stock_qty");
  console.log("");

  if (dryRun) {
    console.log("DRY RUN COMPLETE — no data written.");
    console.log("Run with --confirm to execute live import.");
    return;
  }

  if (!confirm) {
    console.log("LIVE import paused. Add --confirm to execute.");
    return;
  }

  console.log("[LIVE] Inserting products into Supabase ...");
  const { data, error } = await supabase.from("products").insert(products).select("id, name");

  if (error) {
    console.error("INSERT ERROR:", error.message);
    process.exit(1);
  }

  console.log(`SUCCESS — inserted ${data?.length ?? 0} products.`);
  console.log("");
  console.log("Sample inserted IDs:");
  data?.slice(0, 5).forEach(p => console.log(`  ${p.id} | ${p.name}`));

  const { count } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("org_id", ORG_ID);
  console.log("");
  console.log(`Total products in ${ORG_SLUG} catalog: ${count}`);
}

main().catch(err => { console.error(err); process.exit(1); });