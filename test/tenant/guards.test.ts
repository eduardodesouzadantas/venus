import { strict as assert } from "node:assert";

import {
  GuardFailureReason,
  validateGuard,
  requireGuard,
} from "../../src/lib/tenant/guards";

const mockSupabaseClient = (user: Record<string, unknown> | null) => {
  return {
    auth: {
      getUser: async () => ({
        data: { user: user ? { ...user, app_metadata: (user as Record<string, unknown>).app_metadata || {}, user_metadata: (user as Record<string, unknown>).user_metadata || {} } : null },
        error: null,
      }),
    },
  } as any;
};

describe("tenant/guards", () => {
  describe("validateGuard", () => {
    it("rejects unauthenticated when required", async () => {
      const client = mockSupabaseClient(null);
      const result = await validateGuard(client as any, { requireAuthenticated: true });
      assert.equal(result.allowed, false);
      assert.equal(result.reason, "unauthenticated");
    });

    it("allows authenticated when not required", async () => {
      const client = mockSupabaseClient(null);
      const result = await validateGuard(client as any, { requireAuthenticated: false });
      assert.equal(result.allowed, true);
    });

    it("allows when user exists", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_owner" },
      });
      const result = await validateGuard(client as any, { requireAuthenticated: true });
      assert.equal(result.allowed, true);
      assert.equal(result.userId, "user-123");
    });

    it("validates agency role", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "agency_owner" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireAgency: true,
        requireTenantActive: false,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.role, "agency_owner");
    });

    it("rejects merchant for agency-only requirement", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_owner" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireAgency: true,
        requireTenantActive: false,
      });

      assert.equal(result.allowed, false);
      assert.equal(result.reason, "role_forbidden");
    });

    it("validates management role", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_owner" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireManagement: true,
        requireTenantActive: false,
      });

      assert.equal(result.allowed, true);
    });

    it("rejects viewer for management requirement", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_viewer" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireManagement: true,
        requireTenantActive: false,
      });

      assert.equal(result.allowed, false);
      assert.equal(result.reason, "role_forbidden");
    });

    it("validates specific roles", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_manager" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireRoles: ["merchant_owner", "merchant_manager"],
        requireTenantActive: false,
      });

      assert.equal(result.allowed, true);
    });

    it("rejects role not in allowed list", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_viewer" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireRoles: ["merchant_owner", "merchant_manager"],
        requireTenantActive: false,
      });

      assert.equal(result.allowed, false);
      assert.equal(result.reason, "role_forbidden");
    });

    it("validates membership status", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_owner" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireMembershipStatus: "active",
        requireTenantActive: false,
      });

      assert.equal(result.allowed, true);
    });

    it("validates tenant active status", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_owner" },
      });

      const result = await validateGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireTenantActive: true,
      });

      assert.equal(result.allowed, false);
      assert.equal(result.reason, "tenant_not_found");
    });
  });

  describe("requireGuard", () => {
    it("throws on failure", async () => {
      const client = mockSupabaseClient(null);

      try {
        await requireGuard(client as any, { requireAuthenticated: true });
        assert.fail("Should have thrown");
      } catch (err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("Access denied"));
      }
    });

    it("returns result on success", async () => {
      const client = mockSupabaseClient({
        id: "user-123",
        app_metadata: { org_id: "org-123", role: "merchant_owner" },
      });

      const result = await requireGuard(client as any, {
        requireAuthenticated: true,
        requireOrgId: "org-123",
        requireTenantActive: false,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.userId, "user-123");
    });
  });
});