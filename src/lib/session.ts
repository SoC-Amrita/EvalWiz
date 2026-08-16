/**
 * getSessionUser()
 *
 * Drop-in replacement for the old `const session = await auth()` / `session?.user` pattern.
 *
 * Verifies the Supabase session from the request cookies, then returns the
 * matching Prisma User row (which carries role, isAdmin, title, firstName,
 * lastName — everything the app guards and workspace helpers need).
 *
 * Returns null when there is no valid session or the Prisma record is missing.
 * Callers that need to guarantee a user (server actions, guards) should throw
 * or redirect on null; page components already do this via layout.tsx.
 */

import { cache } from "react"
import prisma from "@/lib/db"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>

/**
 * Wrapped with React `cache` so repeated calls within a single render tree
 * (layout + page + server actions invoked during the same request) share
 * one DB round-trip, exactly like the previous auth() pattern.
 *
 * Auth is read via `getSession()` (a local cookie decode) rather than
 * `getUser()` (a network round-trip to Supabase's auth server). Every caller of
 * this function lives under `/dashboard/**`, and `src/middleware.ts` runs
 * `getUser()` on every such request — authoritatively validating and refreshing
 * the token before the render tree executes and redirecting to /login on
 * failure. So by the time we reach here the cookie is already server-verified,
 * and re-validating over the network would just duplicate that work on the
 * critical path. If a caller is ever added on a route NOT covered by the
 * middleware matcher, restore `getUser()` here (or gate that route).
 */
export const getSessionUser = cache(async () => {
  let supabaseUser: { id: string } | null = null

  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error("[session] Supabase getSession failed:", error.message)
      return null
    }

    supabaseUser = session?.user ?? null
  } catch (error) {
    console.error("[session] Unable to initialize Supabase server client:", error)
    return null
  }

  if (!supabaseUser) return null

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  })

  return user
})
