/**
 * Supabase SSR middleware.
 *
 * Runs on every matched request to:
 * 1. Refresh the Supabase session token in cookies (required by @supabase/ssr).
 * 2. Redirect unauthenticated visitors to /login.
 *
 * The matcher intentionally excludes static assets, images, and the login
 * page itself to avoid redirect loops and unnecessary session checks.
 */

import { createServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  // These are inlined at build time; if missing on Vercel, middleware threw and surfaced as
  // MIDDLEWARE_INVOCATION_FAILED. Fail loudly in logs instead of an opaque edge crash.
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configure both in Vercel (all target environments used for production builds) and redeploy.",
    )
    return new NextResponse(null, { status: 503 })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies into the request so downstream code sees them.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Rebuild the response with the refreshed cookies.
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() must be called here (not getSession()) to validate
  // the token with Supabase's server and prevent spoofed cookie attacks.
  let user: User | null = null

  try {
    const { data, error } = await supabase.auth.getUser()
    if (!error) {
      user = data.user
    } else {
      console.error("[middleware] getUser rejected:", error.message)
    }
  } catch (err) {
    console.error("[middleware] getUser failed:", err)
  }

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
}
