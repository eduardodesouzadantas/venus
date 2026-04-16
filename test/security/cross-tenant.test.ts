/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

process.stdout.write("\n=== SECURITY AUDIT: CROSS-TENANT ISOLATION ===\n");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name} - ${error.message}\n`);
    throw error;
  }
}

function readSource(relPath) {
  return fs.readFileSync(path.join(__dirname, "..", "..", relPath), "utf8");
}

run("tenant-config route enforces guard checks", () => {
  const source = readSource("src/app/api/tenant-config/route.ts");

  assert.match(source, /validateGuard/);
  assert.match(source, /requireAuthenticated:\s*true/);
  assert.match(source, /requireOrgId:\s*orgId/);
  assert.match(source, /requireAgency:\s*true/);
  assert.match(source, /Forbidden/);
  assert.match(source, /Unauthorized/);
});

run("result API exposes assisted recommendations", () => {
  const source = readSource("src/app/api/result/[id]/route.ts");

  assert.match(source, /buildAssistedRecommendationSurface/);
  assert.match(source, /assistedRecommendations/);
});

run("tenant guards module loads", () => {
  const { validateGuard } = require("../../src/lib/tenant/guards");
  assert.ok(validateGuard, "validateGuard should exist");
});

run("privacy logging has PII masking", () => {
  const { maskEmail, maskPhone } = require("../../src/lib/privacy/logging");
  assert.strictEqual(maskEmail("test@test.com"), "t***@test.com", "Email should be masked");
  assert.strictEqual(maskPhone("11999999999"), "***9999", "Phone should be masked");
});

process.stdout.write("\n=== SECURITY AUDIT COMPLETE ===\n");
