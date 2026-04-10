const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function isUnsafeHost(hostname: string) {
  const lower = hostname.toLowerCase();
  return lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower.endsWith(".local");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol) || isUnsafeHost(parsed.hostname)) {
    return Response.json({ error: "Unsupported url" }, { status: 400 });
  }

  const upstream = await fetch(parsed.toString(), {
    headers: {
      Accept: "image/*",
      "User-Agent": "VenusEngine/1.0",
    },
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    return Response.json({ error: "Image fetch failed" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
