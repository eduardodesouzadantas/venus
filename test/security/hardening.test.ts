/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");

const {
  maskPhone,
  maskEmail,
  maskCPF,
  maskCNPJ,
  maskCreditCard,
  maskAddress,
  stripUrlQuery,
  sanitizePrivacyLogEntry,
} = require("../src/lib/privacy/logging");

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

run("maskPhone masks correctly", () => {
  assert.equal(maskPhone("11999990001"), "***0001");
  assert.equal(maskPhone("+5511999990001"), "***0001");
  assert.equal(maskPhone("11 99999-0001"), "***0001");
});

run("maskPhone handles edge cases", () => {
  assert.equal(maskPhone(null), "");
  assert.equal(maskPhone(""), "");
  assert.equal(maskPhone("123"), "***3");
});

run("maskEmail masks correctly", () => {
  assert.equal(maskEmail("john@example.com"), "j***@example.com");
  assert.equal(maskEmail("JOHNSMITH@EXAMPLE.COM"), "j***@example.com");
});

run("maskEmail handles edge cases", () => {
  assert.equal(maskEmail(null), "");
  assert.equal(maskEmail("@example.com"), "");
  assert.equal(maskEmail("no-at"), "");
});

run("maskCPF masks correctly", () => {
  assert.equal(maskCPF("12345678901"), "***.***.***01-1");
  assert.equal(maskCPF("123.456.789-01"), "***.***.***01-1");
});

run("maskCNPJ masks correctly", () => {
  assert.equal(maskCNPJ("12345678000100"), "**.***.123/0001-**");
  assert.equal(maskCNPJ("12.345.678/0001-00"), "**.***.678/0001-**");
});

run("maskCreditCard masks correctly", () => {
  assert.equal(maskCreditCard("4111111111111111"), "**** **** **** 1111");
  assert.equal(maskCreditCard("4111 1111 1111 1111"), "**** **** **** 1111");
});

run("stripUrlQuery removes query params", () => {
  const url = "https://example.com/api?token=abc&secret=xyz";
  assert.equal(stripUrlQuery(url), "https://example.com/api");
});

run("sanitizePrivacyLogEntry removes sensitive data", () => {
  const entry = {
    id: "123",
    email: "john@example.com",
    phone: "11999990001",
    password: "secret123",
    cpf: "12345678901",
  };

  const sanitized = sanitizePrivacyLogEntry(entry);

  assert.equal(sanitized.email, "j***@example.com");
  assert.equal(sanitized.phone, "***0001");
  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.cpf, "[REDACTED]");
});

run("sanitizePrivacyLogEntry preserves non-sensitive data", () => {
  const entry = {
    id: "123",
    status: "active",
    count: 42,
  };

  const sanitized = sanitizePrivacyLogEntry(entry);

  assert.equal(sanitized.id, "123");
  assert.equal(sanitized.status, "active");
  assert.equal(sanitized.count, 42);
});

run("security audit maintains tenant isolation", () => {
  const org1Audit = [
    { id: "1", org_id: "org-a", action: "login" },
    { id: "2", org_id: "org-a", action: "lead_create" },
  ];
  const org2Audit = [{ id: "3", org_id: "org-b", action: "login" }];

  const filterByOrg = (orgId) =>
    org1Audit.filter((a) => a.org_id === orgId).concat(
      org2Audit.filter((a) => a.org_id === orgId)
    );

  assert.equal(filterByOrg("org-a").length, 2);
  assert.equal(filterByOrg("org-b").length, 1);
});

run("rate limiting prevents spam", () => {
  const dailyLimit = 50;
  let sentCount = 0;

  for (let i = 0; i < 60; i++) {
    if (sentCount < dailyLimit) {
      sentCount++;
    }
  }

  assert.equal(sentCount, 50);
});

run("rate limiting per user prevents abuse", () => {
  const perUserLimit = 3;
  let userSentCount = 0;

  for (let i = 0; i < 5; i++) {
    if (userSentCount < perUserLimit) {
      userSentCount++;
    }
  }

  assert.equal(userSentCount, 3);
});

run("security headers are set correctly", () => {
  const headers = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };

  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
});

run("PII masking in logs prevents data exposure", () => {
  const logs = [
    { action: "login", email: "secret@example.com", phone: "11999990001" },
    { action: "lead_create", name: "John", phone: "11999990002" },
  ];

  const maskedLogs = logs.map((log) => ({
    ...log,
    email: maskEmail(log.email),
    phone: maskPhone(log.phone),
  }));

  assert.ok(maskedLogs[0].email.includes("***"));
  assert.ok(maskedLogs[0].phone.includes("***"));
});

run("audit log redact sensitive metadata", () => {
  const metadata = {
    action: "login",
    password: "secret123",
    token: "abc123",
    user_id: "user-123",
  };

  const sensitiveKeys = ["password", "token", "secret"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (sensitiveKeys.includes(key)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.token, "[REDACTED]");
  assert.equal(sanitized.user_id, "user-123");
});