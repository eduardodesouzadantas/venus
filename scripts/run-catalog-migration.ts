import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "node:fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MIGRATION = "docs/catalog_products_additive.sql";

async function runManagementQuery(params: {
  projectRef: string;
  accessToken: string;
  query: string;
}) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${params.projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: params.query, read_only: false }),
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText} - ${body}`);
  }
}

function getProjectRef(url: string) {
  const match = new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  if (!match) throw new Error(`Cannot derive project ref from: ${url}`);
  return match[1];
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN!;

  if (!url || !serviceKey || !accessToken) {
    console.error("Missing env vars");
    process.exit(1);
  }

  const sql = await fs.readFile(path.resolve(process.cwd(), MIGRATION), "utf8");

  console.log("Running migration:", MIGRATION);
  console.log("Project ref:", getProjectRef(url));

  await runManagementQuery({
    projectRef: getProjectRef(url),
    accessToken,
    query: sql,
  });

  console.log("Migration applied successfully.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });