import { strict as assert } from "node:assert";

import {
  normalizeTenantSlug,
  resolveTenantContext,
  isMerchantRole,
  isAgencyRole,
  isTenantActive,
  getTenantOperationalError,
  isValidMembershipRole,
  isAgencyRoleStrict,
  isMerchantRoleStrict,
  canManageOrg,
  canEditCatalog,
  canViewAnalytics,
  DEFAULT_TENANT_LIMITS,
} from "../../src/lib/tenant/core";

const mockUser = (overrides: Record<string, unknown> = {}) => ({
  id: "user-123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  ...overrides,
});

describe("tenant/core", () => {
  describe("normalizeTenantSlug", () => {
    it("normalizes lowercase", () => {
      assert.equal(normalizeTenantSlug("MyStore"), "mystore");
    });

    it("removes accents", () => {
      assert.equal(normalizeTenantSlug("Lojã São"), "lojasao");
    });

    it("replaces spaces with dashes", () => {
      assert.equal(normalizeTenantSlug("My Store"), "my-store");
    });

    it("removes invalid chars", () => {
      assert.equal(normalizeTenantSlug("store@#!"), "store");
    });

    it("handles null/undefined", () => {
      assert.equal(normalizeTenantSlug(null), "");
      assert.equal(normalizeTenantSlug(undefined), "");
    });
  });

  describe("resolveTenantContext", () => {
    it("extracts from app_metadata", () => {
      const user = mockUser({
        app_metadata: { org_slug: "myshop", org_id: "org-123", role: "merchant_owner" },
      });
      const ctx = resolveTenantContext(user);
      assert.equal(ctx.orgSlug, "myshop");
      assert.equal(ctx.orgId, "org-123");
      assert.equal(ctx.role, "merchant_owner");
    });

    it("extracts from user_metadata", () => {
      const user = mockUser({
        user_metadata: { org_slug: "myshop", org_id: "org-123", role: "merchant_owner" },
      });
      const ctx = resolveTenantContext(user);
      assert.equal(ctx.orgSlug, "myshop");
      assert.equal(ctx.orgId, "org-123");
      assert.equal(ctx.role, "merchant_owner");
    });

    it("prefers app_metadata over user_metadata", () => {
      const user = mockUser({
        app_metadata: { org_slug: "app-shop", role: "merchant_owner" },
        user_metadata: { org_slug: "user-shop", role: "merchant_viewer" },
      });
      const ctx = resolveTenantContext(user);
      assert.equal(ctx.orgSlug, "app-shop");
      assert.equal(ctx.role, "merchant_owner");
    });

    it("returns nulls for no user", () => {
      const ctx = resolveTenantContext(null);
      assert.equal(ctx.orgSlug, null);
      assert.equal(ctx.orgId, null);
      assert.equal(ctx.role, null);
    });

    it("extracts email and name", () => {
      const user = mockUser({
        email: "test@store.com",
        user_metadata: { name: "John Doe" },
      });
      const ctx = resolveTenantContext(user);
      assert.equal(ctx.email, "test@store.com");
      assert.equal(ctx.name, "John Doe");
    });

    it("falls back to email prefix for name", () => {
      const user = mockUser({
        email: "john@store.com",
      });
      const ctx = resolveTenantContext(user);
      assert.equal(ctx.name, "john");
    });
  });

  describe("isMerchantRole", () => {
    it("detects merchant roles", () => {
      assert.ok(isMerchantRole("merchant_owner"));
      assert.ok(isMerchantRole("merchant_manager"));
      assert.ok(isMerchantRole("merchant_editor"));
      assert.ok(isMerchantRole("merchant_viewer"));
    });

    it("rejects agency roles", () => {
      assert.ok(!isMerchantRole("agency_owner"));
      assert.ok(!isMerchantRole("admin"));
      assert.ok(!isMerchantRole(null));
      assert.ok(!isMerchantRole(undefined));
    });
  });

  describe("isAgencyRole", () => {
    it("detects agency roles", () => {
      assert.ok(isAgencyRole("agency_owner"));
      assert.ok(isAgencyRole("agency_admin"));
      assert.ok(isAgencyRole("agency_ops"));
    });

    it("rejects merchant roles", () => {
      assert.ok(!isAgencyRole("merchant_owner"));
      assert.ok(!isAgencyRole("admin"));
    });
  });

  describe("isTenantActive", () => {
    it("returns true for active tenant", () => {
      const record = { status: "active" as const, kill_switch: false };
      assert.ok(isTenantActive(record));
    });

    it("returns false for suspended", () => {
      const record = { status: "suspended" as const, kill_switch: false };
      assert.ok(!isTenantActive(record));
    });

    it("returns false for blocked", () => {
      const record = { status: "blocked" as const, kill_switch: false };
      assert.ok(!isTenantActive(record));
    });

    it("returns false for kill_switch", () => {
      const record = { status: "active" as const, kill_switch: true };
      assert.ok(!isTenantActive(record));
    });

    it("returns false for null", () => {
      assert.ok(!isTenantActive(null));
      assert.ok(!isTenantActive(undefined));
    });
  });

  describe("getTenantOperationalError", () => {
    it("returns null for active tenant", () => {
      const record = { status: "active" as const, kill_switch: false, slug: "myshop" };
      assert.equal(getTenantOperationalError(record), null);
    });

    it("returns error for suspended", () => {
      const record = { status: "suspended" as const, kill_switch: false, slug: "myshop" };
      const error = getTenantOperationalError(record);
      assert.ok(error?.includes("suspended"));
    });

    it("returns error for blocked", () => {
      const record = { status: "blocked" as const, kill_switch: false, slug: "myshop" };
      const error = getTenantOperationalError(record);
      assert.ok(error?.includes("blocked"));
    });

    it("returns error for kill_switch", () => {
      const record = { status: "active" as const, kill_switch: true, slug: "myshop" };
      const error = getTenantOperationalError(record);
      assert.ok(error?.includes("paused"));
    });

    it("returns error for null", () => {
      assert.equal(getTenantOperationalError(null), "Tenant not found");
    });
  });

  describe("isValidMembershipRole", () => {
    it("validates all roles", () => {
      assert.ok(isValidMembershipRole("agency_owner"));
      assert.ok(isValidMembershipRole("agency_admin"));
      assert.ok(isValidMembershipRole("agency_ops"));
      assert.ok(isValidMembershipRole("agency_support"));
      assert.ok(isValidMembershipRole("merchant_owner"));
      assert.ok(isValidMembershipRole("merchant_manager"));
      assert.ok(isValidMembershipRole("merchant_editor"));
      assert.ok(isValidMembershipRole("merchant_viewer"));
    });

    it("rejects invalid roles", () => {
      assert.ok(!isValidMembershipRole("admin"));
      assert.ok(!isValidMembershipRole("superadmin"));
      assert.ok(!isValidMembershipRole(null));
    });
  });

  describe("isAgencyRoleStrict", () => {
    it("detects agency roles", () => {
      assert.ok(isAgencyRoleStrict("agency_owner"));
      assert.ok(isAgencyRoleStrict("agency_admin"));
    });

    it("rejects merchant roles", () => {
      assert.ok(!isAgencyRoleStrict("merchant_owner"));
    });
  });

  describe("isMerchantRoleStrict", () => {
    it("detects merchant roles", () => {
      assert.ok(isMerchantRoleStrict("merchant_owner"));
      assert.ok(isMerchantRoleStrict("merchant_manager"));
    });

    it("rejects agency roles", () => {
      assert.ok(!isMerchantRoleStrict("agency_owner"));
    });
  });

  describe("canManageOrg", () => {
    it("allows management roles", () => {
      assert.ok(canManageOrg("agency_owner"));
      assert.ok(canManageOrg("agency_admin"));
      assert.ok(canManageOrg("merchant_owner"));
      assert.ok(canManageOrg("merchant_manager"));
    });

    it("denies non-management roles", () => {
      assert.ok(!canManageOrg("merchant_editor"));
      assert.ok(!canManageOrg("merchant_viewer"));
      assert.ok(!canManageOrg("agency_support"));
    });
  });

  describe("canEditCatalog", () => {
    it("allows editor roles", () => {
      assert.ok(canEditCatalog("agency_owner"));
      assert.ok(canEditCatalog("agency_admin"));
      assert.ok(canEditCatalog("agency_ops"));
      assert.ok(canEditCatalog("merchant_owner"));
      assert.ok(canEditCatalog("merchant_manager"));
      assert.ok(canEditCatalog("merchant_editor"));
    });

    it("denies viewer roles", () => {
      assert.ok(!canEditCatalog("merchant_viewer"));
      assert.ok(!canEditCatalog("agency_support"));
    });
  });

  describe("canViewAnalytics", () => {
    it("allows all valid roles", () => {
      assert.ok(canViewAnalytics("agency_owner"));
      assert.ok(canViewAnalytics("agency_admin"));
      assert.ok(canViewAnalytics("agency_ops"));
      assert.ok(canViewAnalytics("agency_support"));
      assert.ok(canViewAnalytics("merchant_owner"));
      assert.ok(canViewAnalytics("merchant_manager"));
      assert.ok(canViewAnalytics("merchant_editor"));
      assert.ok(canViewAnalytics("merchant_viewer"));
    });

    it("denies invalid roles", () => {
      assert.ok(!canViewAnalytics("admin"));
      assert.ok(!canViewAnalytics(null));
    });
  });

  describe("DEFAULT_TENANT_LIMITS", () => {
    it("has expected defaults", () => {
      assert.equal(DEFAULT_TENANT_LIMITS.ai_tokens_monthly, 250000);
      assert.equal(DEFAULT_TENANT_LIMITS.whatsapp_messages_daily, 1000);
      assert.equal(DEFAULT_TENANT_LIMITS.products, 500);
      assert.equal(DEFAULT_TENANT_LIMITS.leads, 10000);
    });
  });
});