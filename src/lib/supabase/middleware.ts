import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Proteger rotas B2B exceto login
  if (!user && request.nextUrl.pathname.startsWith('/b2b') && !request.nextUrl.pathname.startsWith('/b2b/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/b2b/login'
    return NextResponse.redirect(url)
  }

  // Redirect pro dashboard se tentar logar já estando autorizado
  if (user && request.nextUrl.pathname.startsWith('/b2b/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/b2b/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
