import * as dotenv from "dotenv";
import { existsSync } from "node:fs";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MIGRATIONS = [
  "docs/org_branding.sql",
  "docs/merchant_groups.sql",
  "docs/products_enrichment.sql",
  "docs/product_variants.sql",
  "docs/tryon_events.sql",
  "docs/share_system.sql",
].filter((relativePath) => {
  if (relativePath === "docs/merchant_groups.sql") {
    return true;
  }

  return existsSync(path.resolve(process.cwd(), relativePath));
});

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

function getProjectRef(url: string) {
  const parsed = new URL(url);
  const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);

  if (!match) {
    throw new Error(`Unable to derive Supabase project ref from URL: ${url}`);
  }

  return match[1];
}

function getRepoRoot() {
  return path.resolve(process.cwd());
}

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
      body: JSON.stringify({
        query: params.query,
        read_only: false,
      }),
    }
  );

  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new Error(
    body
      ? `${response.status} ${response.statusText} - ${body}`
      : `${response.status} ${response.statusText}`
  );
}

async function main() {
  const [{ createClient }, { readFile }] = await Promise.all([
    import("@supabase/supabase-js"),
    import("node:fs/promises"),
  ]);

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = requireEnv("SUPABASE_ACCESS_TOKEN");
  const admin = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (authError) {
    throw new Error(`Supabase service role validation failed: ${authError.message}`);
  }

  const projectRef = getProjectRef(url);
  const root = getRepoRoot();

  for (const relativePath of MIGRATIONS) {
    const absolutePath = path.join(root, relativePath);
    const sql = await readFile(absolutePath, "utf8");
    const fileName = path.basename(relativePath);

    try {
      await runManagementQuery({
        projectRef,
        accessToken,
        query: sql,
      });
      console.log(`✅ ${fileName} — ok`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${fileName} — erro: ${message}`);
      process.exitCode = 1;
      return;
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`❌ migrate — erro: ${message}`);
  process.exitCode = 1;
});
