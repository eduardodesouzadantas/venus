import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  fetchTenantBySlug,
  fetchTenantById,
  isAgencyRole,
  isTenantActive,
  resolveTenantContext,
} from "@/lib/tenant/core";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Ignore missing ENV keys in development so build doesn't break if .env isn't set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tenantContext = resolveTenantContext(user);
  const pathname = request.nextUrl.pathname;
  const isMerchantLogin = pathname.startsWith("/b2b/login");
  const isB2BRoute = pathname.startsWith("/b2b");
  const isMerchantRoute = pathname.startsWith("/merchant");
  const isAgencyRoute = pathname.startsWith("/agency");
  const isOrgRoute = pathname.startsWith("/org/");

  const redirectTo = (targetPath: string) => {
    const url = request.nextUrl.clone();
    url.pathname = targetPath;
    return NextResponse.redirect(url);
  };

  if (!user && isB2BRoute && !isMerchantLogin) {
    return redirectTo("/b2b/login");
  }

  if (user && isMerchantLogin) {
    if (tenantContext.role && isAgencyRole(tenantContext.role)) {
      return redirectTo("/agency");
    }

    return redirectTo("/merchant");
  }

  if (isMerchantRoute && !user) {
    return redirectTo("/b2b/login");
  }

  if (isMerchantRoute && user && tenantContext.role && isAgencyRole(tenantContext.role)) {
    return redirectTo("/agency");
  }

  if (isAgencyRoute) {
    if (!user) {
      return redirectTo("/login");
    }

    if (tenantContext.role && isAgencyRole(tenantContext.role)) {
      return supabaseResponse;
    }

    return redirectTo("/merchant");
  }

  if (isOrgRoute) {
    if (!user) {
      return redirectTo("/merchant");
    }

    if (tenantContext.role && isAgencyRole(tenantContext.role)) {
      return supabaseResponse;
    }

    const orgSlug = pathname.split("/")[2] || "";
    const authOrgSlug = tenantContext.orgSlug || "";
    const authOrgId = tenantContext.orgId || "";

    if (authOrgId) {
      const tenantById = await fetchTenantById(supabase, authOrgId);
      if (tenantById.org && isTenantActive(tenantById.org)) {
        if (orgSlug && tenantById.org.slug !== orgSlug) {
          return redirectTo("/merchant");
        }
        return supabaseResponse;
      }
    }

    if (!authOrgSlug || authOrgSlug !== orgSlug) {
      return redirectTo("/merchant");
    }

    const tenant = await fetchTenantBySlug(supabase, orgSlug);
    if (!tenant.org || !isTenantActive(tenant.org)) {
      return redirectTo("/merchant");
    }
  }

  return supabaseResponse;
}
