import { NextResponse, type NextRequest } from "next/server";

const SECURITY_HEADERS = {
  "X-DNS-Prefetch-Control": "no-dns-prefetch",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-guard 'deny'",
].join("; ");

export async function securityHeadersMiddleware(request: NextRequest) {
  const response = NextResponse.next();

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  response.headers.set("Content-Security-Policy", CSP_DIRECTIVES);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  return response;
}

export async function securityMiddleware(request: NextRequest) {
  const start = Date.now();

  const response = await securityHeadersMiddleware(request);

  response.headers.set("Server-Timing", `app;dur=${Date.now() - start}`);

  return response;
}