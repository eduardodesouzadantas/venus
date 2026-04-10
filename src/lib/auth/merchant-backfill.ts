import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureTenantCoreRecords, normalizeTenantSlug } from "@/lib/tenant/core";

type AuthUserRecord = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

type MerchantBackfillOptions = {
  dryRun?: boolean;
  defaultOrgSlug?: string;
};

type MerchantBackfillRecord = {
  user_id: string;
  email: string;
  role: string;
  before_org_slug: string | null;
  resolved_org_slug: string;
  action: "skip" | "update" | "conflict";
  reason: string;
};

export type MerchantBackfillReport = {
  scanned_users: number;
  merchant_users: number;
  already_canonical: number;
  missing_metadata: number;
  needs_backfill: number;
  updated: number;
  conflicts: number;
  skipped_non_merchant: number;
  canonical_rate: number;
  records: MerchantBackfillRecord[];
};

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOrgSlug(metadata: Record<string, unknown> | null | undefined) {
  return normalizeTenantSlug(
    (metadata?.org_slug as string | null | undefined) || (metadata?.org_id as string | null | undefined)
  );
}

function readRole(metadata: Record<string, unknown> | null | undefined) {
  return normalize(metadata?.role);
}

function readName(metadata: Record<string, unknown> | null | undefined) {
  return normalize(metadata?.name);
}

function isMerchantRole(role: string) {
  return role.startsWith("merchant_");
}

function canonicalAppMetadata(
  current: Record<string, unknown> | null | undefined,
  resolvedOrgSlug: string,
  role: string
) {
  return {
    ...(current || {}),
    org_slug: resolvedOrgSlug,
    org_id: resolvedOrgSlug,
    role,
    tenant_source: normalize(current?.tenant_source) || "merchant_backfill",
  };
}

function canonicalUserMetadata(
  current: Record<string, unknown> | null | undefined,
  resolvedOrgSlug: string,
  role: string,
  email: string,
  name: string
) {
  return {
    ...(current || {}),
    org_slug: resolvedOrgSlug,
    org_id: resolvedOrgSlug,
    role,
    email: normalize(current?.email) || email,
    name: normalize(current?.name) || name,
  };
}

function metadataChanged(
  current: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
) {
  return JSON.stringify(current || {}) !== JSON.stringify(next);
}

export async function backfillMerchantAuthUsers(
  admin: SupabaseClient,
  options: MerchantBackfillOptions = {}
): Promise<MerchantBackfillReport> {
  const dryRun = options.dryRun ?? true;
  const defaultOrgSlug = normalize(options.defaultOrgSlug);
  if (!defaultOrgSlug) {
    throw new Error("defaultOrgSlug is required for merchant backfill");
  }
  const perPage = 1000;

  const report: MerchantBackfillReport = {
    scanned_users: 0,
    merchant_users: 0,
    already_canonical: 0,
    missing_metadata: 0,
    needs_backfill: 0,
    updated: 0,
    conflicts: 0,
    skipped_non_merchant: 0,
    canonical_rate: 0,
    records: [],
  };

  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list Supabase users: ${error.message}`);
    }

    const users = (data.users || []) as AuthUserRecord[];

    for (const user of users) {
      report.scanned_users += 1;

      const appMetadata = user.app_metadata || {};
      const userMetadata = user.user_metadata || {};
      const role = readRole(appMetadata) || readRole(userMetadata);

      if (!isMerchantRole(role)) {
        report.skipped_non_merchant += 1;
        continue;
      }

      report.merchant_users += 1;

      const appOrgSlug = readOrgSlug(appMetadata);
      const userOrgSlug = readOrgSlug(userMetadata);
      const currentOrgSlug = appOrgSlug || userOrgSlug;
      const email = normalize(user.email);
      const displayName = readName(userMetadata) || email.split("@")[0] || "merchant";
      const hasNoMetadata = !appOrgSlug && !userOrgSlug;

      if (appOrgSlug && userOrgSlug && appOrgSlug !== userOrgSlug) {
        report.conflicts += 1;
        report.records.push({
          user_id: user.id,
          email,
          role,
          before_org_slug: currentOrgSlug || null,
          resolved_org_slug: currentOrgSlug || defaultOrgSlug,
          action: "conflict",
          reason: "app_metadata and user_metadata org claims differ",
        });
        continue;
      }

      const resolvedOrgSlug = currentOrgSlug || defaultOrgSlug;
      if (hasNoMetadata) {
        report.missing_metadata += 1;
      }

      const nextAppMetadata = canonicalAppMetadata(appMetadata, resolvedOrgSlug, role);
      const nextUserMetadata = canonicalUserMetadata(userMetadata, resolvedOrgSlug, role, email, displayName);
      const isCanonical = Boolean(appOrgSlug) && Boolean(userOrgSlug) && appOrgSlug === userOrgSlug;
      const needsUpdate = metadataChanged(appMetadata, nextAppMetadata) || metadataChanged(userMetadata, nextUserMetadata);

      if (!needsUpdate) {
        report.already_canonical += 1;
        report.records.push({
          user_id: user.id,
          email,
          role,
          before_org_slug: currentOrgSlug || null,
          resolved_org_slug: resolvedOrgSlug,
          action: "skip",
          reason: isCanonical ? "already canonical" : "requires no-op",
        });
        continue;
      }

      report.needs_backfill += 1;
      report.records.push({
        user_id: user.id,
        email,
        role,
        before_org_slug: currentOrgSlug || null,
        resolved_org_slug: resolvedOrgSlug,
        action: dryRun ? "skip" : "update",
        reason: dryRun ? "dry run" : "metadata backfilled",
      });

      if (dryRun) {
        continue;
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: nextAppMetadata,
        user_metadata: nextUserMetadata,
        email_confirm: true,
      });

      if (updateError) {
        throw new Error(`Failed to update user ${user.email || user.id}: ${updateError.message}`);
      }

      await ensureTenantCoreRecords(admin, {
        orgSlug: resolvedOrgSlug,
        orgName: displayName,
        ownerUserId: user.id,
        role,
        source: "merchant_backfill",
      });

      report.updated += 1;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  report.canonical_rate = report.merchant_users > 0 ? report.already_canonical / report.merchant_users : 0;

  return report;
}
