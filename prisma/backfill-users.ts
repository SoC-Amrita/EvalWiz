/**
 * One-time backfill: upsert canonical users into both Supabase Auth and Prisma,
 * then normalise name/role fields for any remaining Prisma users.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   BACKFILL_ADMIN_PASSWORD=... BACKFILL_MENTOR_PASSWORD=... BACKFILL_FACULTY_PASSWORD=... \
 *   npx tsx prisma/backfill-users.ts
 */

import { PrismaClient } from "@prisma/client"
import { createClient } from "@supabase/supabase-js"

const prisma = new PrismaClient()

type CanonicalUser = {
  email: string
  title: "Dr." | "Prof."
  firstName: string
  lastName: string
  role: "MENTOR" | "FACULTY"
  isAdmin: boolean
}

const CANONICAL_USERS: CanonicalUser[] = [
  { email: "admin@amrita.edu",    title: "Dr.",   firstName: "Anita",    lastName: "Raman",          role: "MENTOR",  isAdmin: true  },
  { email: "mentor1@amrita.edu",  title: "Dr.",   firstName: "Malathi",  lastName: "P",              role: "MENTOR",  isAdmin: false },
  { email: "mentor2@amrita.edu",  title: "Prof.", firstName: "Krishna",  lastName: "Priya",          role: "MENTOR",  isAdmin: false },
  { email: "fac1@amrita.edu",     title: "Dr.",   firstName: "Anisha",   lastName: "Radhakrishnan",  role: "FACULTY", isAdmin: false },
  { email: "fac2@amrita.edu",     title: "Dr.",   firstName: "Vedaj",    lastName: "Padman",         role: "FACULTY", isAdmin: false },
  { email: "fac3@amrita.edu",     title: "Dr.",   firstName: "Suchithra",lastName: "M",              role: "FACULTY", isAdmin: false },
  { email: "fac4@amrita.edu",     title: "Prof.", firstName: "Senthil",  lastName: "Kumar",          role: "FACULTY", isAdmin: false },
  { email: "fac5@amrita.edu",     title: "Dr.",   firstName: "Aparna",   lastName: "Nair",           role: "FACULTY", isAdmin: false },
  { email: "fac6@amrita.edu",     title: "Prof.", firstName: "Rohit",    lastName: "Menon",          role: "FACULTY", isAdmin: false },
]

function requireEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Set ${name} before running prisma/backfill-users.ts`)
  return value
}

function buildName(title: string, firstName: string, lastName: string) {
  return `${title} ${firstName} ${lastName}`.replace(/\s+/g, " ").trim()
}

function inferNameFields(name: string) {
  const trimmed = name.trim()
  const title = trimmed.startsWith("Prof.") ? "Prof." : "Dr."
  const withoutTitle = trimmed.replace(/^(Dr\.|Prof\.)\s+/, "").trim()
  const parts = withoutTitle.split(/\s+/).filter(Boolean)
  return { title, firstName: parts[0] || "Faculty", lastName: parts.slice(1).join(" ") || "User" }
}

function getSupabaseAdmin() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function upsertCanonicalUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  user: CanonicalUser,
  password: string
) {
  const name = buildName(user.title, user.firstName, user.lastName)

  // Upsert in Supabase Auth — create if absent, update password if exists.
  const { data: listData } = await admin.auth.admin.listUsers()
  const existing = listData?.users.find((u) => u.email === user.email)

  let supabaseId: string
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password })
    supabaseId = existing.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: user.email, password, email_confirm: true,
    })
    if (error || !data.user) throw new Error(`Failed to create ${user.email}: ${error?.message}`)
    supabaseId = data.user.id
  }

  // Upsert in Prisma.
  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update:  { supabaseId, title: user.title, firstName: user.firstName, lastName: user.lastName, name, role: user.role, isAdmin: user.isAdmin },
    create:  { supabaseId, email: user.email, title: user.title, firstName: user.firstName, lastName: user.lastName, name, role: user.role, isAdmin: user.isAdmin },
  })

  // Ensure Faculty record exists.
  const existingFaculty = await prisma.faculty.findUnique({ where: { userId: saved.id }, select: { id: true } })
  if (existingFaculty) {
    await prisma.faculty.update({ where: { id: existingFaculty.id }, data: { name } })
  } else {
    await prisma.faculty.create({ data: { userId: saved.id, name } })
  }
}

async function normalizeRemainingUsers() {
  const users = await prisma.user.findMany({ include: { faculty: true } })

  for (const user of users) {
    const inferred = inferNameFields(user.name)
    const title = user.title || inferred.title
    const firstName = user.firstName || inferred.firstName
    const lastName = user.lastName || inferred.lastName
    const role = user.role === "ADMIN" || user.role === "MENTOR_ADMIN" ? "MENTOR" : user.role
    const isAdmin = user.role === "ADMIN" ? true : user.isAdmin === true
    const name = buildName(title, firstName, lastName)

    await prisma.user.update({ where: { id: user.id }, data: { title, firstName, lastName, name, role, isAdmin } })

    if (role === "MENTOR" || role === "FACULTY") {
      if (user.faculty) {
        await prisma.faculty.update({ where: { id: user.faculty.id }, data: { name } })
      } else {
        await prisma.faculty.create({ data: { userId: user.id, name } })
      }
    }
  }
}

async function main() {
  const admin = getSupabaseAdmin()
  const adminPassword   = requireEnv("BACKFILL_ADMIN_PASSWORD")
  const mentorPassword  = requireEnv("BACKFILL_MENTOR_PASSWORD")
  const facultyPassword = requireEnv("BACKFILL_FACULTY_PASSWORD")

  for (const user of CANONICAL_USERS) {
    const password = user.isAdmin ? adminPassword : user.role === "MENTOR" ? mentorPassword : facultyPassword
    console.log(`Upserting ${user.email}…`)
    await upsertCanonicalUser(admin, user, password)
  }

  await normalizeRemainingUsers()

  const summary = await prisma.user.findMany({
    orderBy: [{ isAdmin: "desc" }, { role: "asc" }, { email: "asc" }],
    select: { email: true, role: true, isAdmin: true, name: true, supabaseId: true },
  })

  console.table(summary)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
