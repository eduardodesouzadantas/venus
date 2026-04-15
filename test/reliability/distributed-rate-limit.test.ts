/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const {
  checkInMemoryRateLimitWithRedis,
  checkDatabaseRateLimit,
} = require("../src/lib/reliability/distributed-rate-limit");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const createMockRequest = (overrides = {}) => ({
  headers: new Map(
    Object.entries({
      "x-forwarded-for": "192.168.1.1",
      "x-real-ip": "192.168.1.1",
      "x-org-id": "org-123",
      "x-user-id": "user-456",
      ...overrides,
    }).map(([k, v]) => [k, v])
  ),
  url: "https://example.com/api",
  method: "GET",
  body: null,
});

run("rate limiting accepts valid requests", async () => {
  globalThis.__venus_rate_limit_store__ = new Map();

  const request = createMockRequest();
  const result = await checkInMemoryRateLimitWithRedis(request, {
    scope: "api",
    limit: 100,
    windowSeconds: 60,
    key: "api",
  });

  assert.equal(result.allowed, true);
});

run("rate limiting blocks excessive requests", async () => {
  const store = new Map();
  const now = Date.now();

  for (let i = 0; i < 10; i++) {
    store.set(`api|org-123|user-456|192.168.1.1`, {
      hits: Array.from({ length: 10 }, () => now),
      windowStart: now,
    });
  }

  globalThis.__venus_rate_limit_store__ = store;

  const request = createMockRequest();
  const result = await checkInMemoryRateLimitWithRedis(request, {
    scope: "api",
    limit: 10,
    windowSeconds: 60,
    key: "api",
  });

  assert.equal(result.allowed, false);
});

run("rate limiting tracks per-scope correctly", async () => {
  globalThis.__venus_rate_limit_store__ = new Map();

  const request1 = createMockRequest();
  const request2 = createMockRequest({ "x-org-id": "org-456" });

  const result1 = await checkInMemoryRateLimitWithRedis(request1, {
    scope: "api",
    limit: 100,
    windowSeconds: 60,
    key: "scope1",
  });

  globalThis.__venus_rate_limit_store__?.set(`api|org-456|user-456|192.168.1.1`, {
    hits: [],
    windowStart: Date.now(),
  });

  const result2 = await checkInMemoryRateLimitWithRedis(request2, {
    scope: "api",
    limit: 100,
    windowSeconds: 60,
    key: "scope2",
  });

  assert.equal(result1.allowed, true);
  assert.equal(result2.allowed, true);
});

run("rate limiting isolates per-org correctly", async () => {
  const store = new Map();

  store.set(`api|org-abc|user-1|1.2.3.4`, {
    hits: Array.from({ length: 50 }, () => Date.now()),
    windowStart: Date.now(),
  });

  store.set(`api|org-xyz|user-1|1.2.3.4`, {
    hits: Array.from({ length: 5 }, () => Date.now()),
    windowStart: Date.now(),
  });

  globalThis.__venus_rate_limit_store__ = store;

  const orgARequest = createMockRequest({
    "x-org-id": "org-abc",
    "x-user-id": "user-1",
  });
  const orgBRequest = createMockRequest({
    "x-org-id": "org-xyz",
    "x-user-id": "user-1",
  });

  const resultA = await checkInMemoryRateLimitWithRedis(orgARequest, {
    scope: "api",
    limit: 50,
    windowSeconds: 60,
    key: "api",
  });

  const resultB = await checkInMemoryRateLimitWithRedis(orgBRequest, {
    scope: "api",
    limit: 50,
    windowSeconds: 60,
    key: "api",
  });

  assert.equal(resultA.allowed, false);
  assert.equal(resultB.allowed, true);
});

run("rate limiting enforces per-user limits", async () => {
  const store = new Map();

  store.set(`api|org-123|user-spammer|1.2.3.4`, {
    hits: Array.from({ length: 5 }, () => Date.now()),
    windowStart: Date.now(),
  });

  globalThis.__venus_rate_limit_store__ = store;

  const spammerRequest = createMockRequest({
    "x-org-id": "org-123",
    "x-user-id": "user-spammer",
  });

  const result = await checkInMemoryRateLimitWithRedis(spammerRequest, {
    scope: "api",
    limit: 5,
    windowSeconds: 60,
    key: "api",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.used, 5);
});

run("rate limiting supports custom scopes", async () => {
  globalThis.__venus_rate_limit_store__ = new Map();

  const loginRequest = createMockRequest();
  const apiRequest = createMockRequest();

  const loginResult = await checkInMemoryRateLimitWithRedis(loginRequest, {
    scope: "login",
    limit: 5,
    windowSeconds: 300,
    key: "login",
  });

  const apiResult = await checkInMemoryRateLimitWithRedis(apiRequest, {
    scope: "api",
    limit: 100,
    windowSeconds: 60,
    key: "api",
  });

  assert.equal(loginResult.allowed, true);
  assert.equal(apiResult.allowed, true);
  assert.equal(loginResult.retryAfterSeconds?.length > 0, true);
});

run("rate limiting handles missing headers gracefully", async () => {
  globalThis.__venus_rate_limit_store__ = new Map();

  const requestNoHeaders = {
    headers: new Map(),
    url: "https://example.com",
    method: "GET",
  };

  const result = await checkInMemoryRateLimitWithRedis(
    requestNoHeaders as any,
    {
      scope: "api",
      limit: 100,
      windowSeconds: 60,
      key: "api",
    }
  );

  assert.equal(result.allowed, true);
});

run("distributed rate limit check returns expected structure", async () => {
  const fakeRequest = {
    headers: new Map(),
    url: "https://example.com/api",
  };

  const scope = "distributed-api";
  const limit = 100;
  const windowSeconds = 60;

  const result = await checkDatabaseRateLimit({
    scope,
    limit,
    windowSeconds,
    key: scope,
  });

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  assert.equal(typeof result.retryAfterSeconds === "number" || result.retryAfterSeconds === null, true);
});

run("rate limiting respects window expiration", async () => {
  const now = Date.now();
  const oldNow = now - 120000;

  const store = new Map();
  store.set("api|expired", {
    hits: [oldNow],
    windowStart: oldNow,
  });

  globalThis.__venus_rate_limit_store__ = store;

  const request = createMockRequest();
  const result = await checkInMemoryRateLimitWithRedis(request, {
    scope: "api",
    limit: 1,
    windowSeconds: 60,
    key: "expired",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.used, 0);
});

run("rate limit returns correct remaining count", async () => {
  const now = Date.now();

  const store = new Map();
  store.set("api|count", {
    hits: Array.from({ length: 7 }, (_, i) => now - i * 1000),
    windowStart: now,
  });

  globalThis.__venus_rate_limit_store__ = store;

  const request = createMockRequest();
  const result = await checkInMemoryRateLimitWithRedis(request, {
    scope: "api",
    limit: 10,
    windowSeconds: 60,
    key: "count",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 3);
  assert.equal(result.used, 7);
});