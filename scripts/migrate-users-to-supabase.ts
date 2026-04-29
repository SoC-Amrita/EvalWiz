/**
 * One-time migration: create existing Prisma users in Supabase Auth and
 * back-fill User.supabaseId.
 *
 * Since the password column was dropped, we cannot recover anyone's original
 * credentials.  For each un-migrated user the script:
 *   1. Creates them in Supabase Auth with a random temporary password.
 *   2. Immediately generates a password-reset magic link so they can set their
 *      own password on first login.
 *   3. Updates User.supabaseId in Prisma.
 *
 * The script is fully idempotent — it skips users whose supabaseId is already
 * set and gracefully handles the case where a Supabase Auth account with the
 * same email already exists (e.g. from a previous partial run).
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  \
 *   APP_URL=https://eval-wiz.vercel.app                           \
 *   npx tsx scripts/migrate-users-to-supabase.ts
 *
 * APP_URL is used as the redirect target in password-reset links.
 * It defaults to http://localhost:3000 if not set.
 *
 * Output: a table of every migrated user with their one-time reset link.
 * Distribute these links to users so they can set their own passwords.
 * Links expire after 1 hour by default (configurable in Supabase dashboard).
 */

import { PrismaClient } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"
import { randomBytes } from "node:crypto"

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(
      `Environment variable ${name} is required. Set it before running this script.`
    )
  }
  return value
}

const APP_URL = process.env.APP_URL?.trim() || "http://localhost:3000"
const RESET_REDIRECT = `${APP_URL}/login`

function getAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomTempPassword(): string {
  // Long enough that it can't be guessed; users will replace it immediately.
  return randomBytes(24).toString("base64url")
}

type MigrationResult =
  | { status: "skipped"; email: string; reason: string }
  | { status: "migrated"; email: string; supabaseId: string; resetLink: string }
  | { status: "error"; email: string; error: string }

async function migrateUser(
  admin: ReturnType<typeof getAdminClient>,
  prismaUser: { id: string; email: string; name: string }
): Promise<MigrationResult> {
  const { email, id: prismaId } = prismaUser

  // ------------------------------------------------------------------
  // Step 1: resolve or create the Supabase Auth account
  // ------------------------------------------------------------------
  let supabaseId: string

  // Check if a Supabase user with this email already exists (re-run safety).
  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (listError) {
    return { status: "error", email, error: `Failed to list auth users: ${listError.message}` }
  }

  const existing = listData.users.find((u) => u.email === email)

  if (existing) {
    supabaseId = existing.id
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: randomTempPassword(),
      email_confirm: true, // bypass email confirmation for internal accounts
    })

    if (createError || !created.user) {
      return {
        status: "error",
        email,
        error: `Failed to create Supabase Auth user: ${createError?.message ?? "unknown error"}`,
      }
    }

    supabaseId = created.user.id
  }

  // ------------------------------------------------------------------
  // Step 2: generate a password-reset magic link
  // ------------------------------------------------------------------
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: RESET_REDIRECT },
  })

  const resetLink =
    linkError || !linkData?.properties?.action_link
      ? `[link generation failed: ${linkError?.message ?? "unknown"}]`
      : linkData.properties.action_link

  // ------------------------------------------------------------------
  // Step 3: back-fill supabaseId in Prisma
  // ------------------------------------------------------------------
  try {
    await prisma.user.update({
      where: { id: prismaId },
      data: { supabaseId },
    })
  } catch (err) {
    return {
      status: "error",
      email,
      error: `Supabase account created (${supabaseId}) but Prisma update failed: ${String(err)}`,
    }
  }

  return { status: "migrated", email, supabaseId, resetLink }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const admin = getAdminClient()

  // Only migrate users that haven't been linked yet.
  const pendingUsers = await prisma.user.findMany({
    where: { supabaseId: null },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  })

  if (pendingUsers.length === 0) {
    console.log("✅  All users already have a supabaseId — nothing to migrate.")
    return
  }

  console.log(`\nMigrating ${pendingUsers.length} user(s) to Supabase Auth…\n`)

  const results: MigrationResult[] = []

  for (const user of pendingUsers) {
    process.stdout.write(`  ${user.email} … `)
    const result = await migrateUser(admin, user)
    results.push(result)

    if (result.status === "migrated") {
      console.log("✅  migrated")
    } else if (result.status === "skipped") {
      console.log(`⏭   skipped (${result.reason})`)
    } else {
      console.log(`❌  error: ${result.error}`)
    }
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const migrated = results.filter((r) => r.status === "migrated") as Extract<
    MigrationResult,
    { status: "migrated" }
  >[]
  const errors = results.filter((r) => r.status === "error") as Extract<
    MigrationResult,
    { status: "error" }
  >[]

  console.log(`\n${"─".repeat(72)}`)
  console.log(`  Total: ${results.length}  |  Migrated: ${migrated.length}  |  Errors: ${errors.length}`)
  console.log(`${"─".repeat(72)}\n`)

  if (migrated.length > 0) {
    console.log("Password-reset links (share these with each user — expire in 1 h):\n")
    for (const r of migrated) {
      console.log(`  ${r.email}`)
      console.log(`  ${r.resetLink}`)
      console.log()
    }
  }

  if (errors.length > 0) {
    console.log("Errors (re-run the script to retry these):\n")
    for (const r of errors) {
      console.log(`  ${r.email}: ${r.error}`)
    }
    process.exit(1)
  }
}

main()
  .catch((err) => {
    console.error("\nFatal error:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
