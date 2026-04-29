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
 */
export const getSessionUser = cache(async () => {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  if (!supabaseUser) return null

  const user = await prisma.user.findUnique({
    where: { supabaseId: supabaseUser.id },
  })

  return user
})
