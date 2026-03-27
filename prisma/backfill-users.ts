import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

type CanonicalUser = {
  email: string
  title: "Dr." | "Prof."
  firstName: string
  lastName: string
  role: "MENTOR" | "FACULTY"
  isAdmin: boolean
  password: string
}

const CANONICAL_USERS: CanonicalUser[] = [
  {
    email: "admin@amrita.edu",
    title: "Dr.",
    firstName: "Anita",
    lastName: "Raman",
    role: "MENTOR",
    isAdmin: true,
    password: "admin123",
  },
  {
    email: "mentor1@amrita.edu",
    title: "Dr.",
    firstName: "Malathi",
    lastName: "P",
    role: "MENTOR",
    isAdmin: false,
    password: "admin123",
  },
  {
    email: "mentor2@amrita.edu",
    title: "Prof.",
    firstName: "Krishna",
    lastName: "Priya",
    role: "MENTOR",
    isAdmin: false,
    password: "admin123",
  },
  {
    email: "fac1@amrita.edu",
    title: "Dr.",
    firstName: "Anisha",
    lastName: "Radhakrishnan",
    role: "FACULTY",
    isAdmin: false,
    password: "faculty123",
  },
  {
    email: "fac2@amrita.edu",
    title: "Dr.",
    firstName: "Vedaj",
    lastName: "Padman",
    role: "FACULTY",
    isAdmin: false,
    password: "faculty123",
  },
  {
    email: "fac3@amrita.edu",
    title: "Dr.",
    firstName: "Suchithra",
    lastName: "M",
    role: "FACULTY",
    isAdmin: false,
    password: "faculty123",
  },
  {
    email: "fac4@amrita.edu",
    title: "Prof.",
    firstName: "Senthil",
    lastName: "Kumar",
    role: "FACULTY",
    isAdmin: false,
    password: "faculty123",
  },
  {
    email: "fac5@amrita.edu",
    title: "Dr.",
    firstName: "Aparna",
    lastName: "Nair",
    role: "FACULTY",
    isAdmin: false,
    password: "faculty123",
  },
  {
    email: "fac6@amrita.edu",
    title: "Prof.",
    firstName: "Rohit",
    lastName: "Menon",
    role: "FACULTY",
    isAdmin: false,
    password: "faculty123",
  },
]

function buildName(title: string, firstName: string, lastName: string) {
  return `${title} ${firstName} ${lastName}`.replace(/\s+/g, " ").trim()
}

function inferNameFields(name: string) {
  const trimmed = name.trim()
  const title = trimmed.startsWith("Prof.") ? "Prof." : "Dr."
  const withoutTitle = trimmed.replace(/^(Dr\.|Prof\.)\s+/, "").trim()
  const parts = withoutTitle.split(/\s+/).filter(Boolean)

  return {
    title,
    firstName: parts[0] || "Faculty",
    lastName: parts.slice(1).join(" ") || "User",
  }
}

async function upsertCanonicalUser(user: CanonicalUser) {
  const passwordHash = await bcrypt.hash(user.password, 10)
  const name = buildName(user.title, user.firstName, user.lastName)

  const saved = await prisma.user.upsert({
    where: { email: user.email },
    update: {
      title: user.title,
      firstName: user.firstName,
      lastName: user.lastName,
      name,
      role: user.role,
      isAdmin: user.isAdmin,
      password: passwordHash,
    },
    create: {
      email: user.email,
      title: user.title,
      firstName: user.firstName,
      lastName: user.lastName,
      name,
      role: user.role,
      isAdmin: user.isAdmin,
      password: passwordHash,
    },
  })

  if (user.role === "MENTOR" || user.role === "FACULTY") {
    const existingFaculty = await prisma.faculty.findUnique({
      where: { userId: saved.id },
      select: { id: true },
    })

    if (existingFaculty) {
      await prisma.faculty.update({
        where: { id: existingFaculty.id },
        data: { name },
      })
    } else {
      await prisma.faculty.create({
        data: {
          userId: saved.id,
          name,
        },
      })
    }
  }
}

async function normalizeRemainingUsers() {
  const users = await prisma.user.findMany({
    include: { faculty: true },
  })

  for (const user of users) {
    const inferred = inferNameFields(user.name)
    const title = user.title || inferred.title
    const firstName = user.firstName || inferred.firstName
    const lastName = user.lastName || inferred.lastName
    const role = user.role === "ADMIN" || user.role === "MENTOR_ADMIN" ? "MENTOR" : user.role
    const isAdmin = user.role === "ADMIN" ? true : user.isAdmin === true
    const name = buildName(title, firstName, lastName)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        title,
        firstName,
        lastName,
        name,
        role,
        isAdmin,
      },
    })

    if (role === "MENTOR" || role === "FACULTY") {
      if (user.faculty) {
        await prisma.faculty.update({
          where: { id: user.faculty.id },
          data: { name },
        })
      } else {
        await prisma.faculty.create({
          data: {
            userId: user.id,
            name,
          },
        })
      }
    }
  }
}

async function main() {
  for (const user of CANONICAL_USERS) {
    await upsertCanonicalUser(user)
  }

  await normalizeRemainingUsers()

  const summary = await prisma.user.findMany({
    orderBy: [{ isAdmin: "desc" }, { role: "asc" }, { email: "asc" }],
    select: {
      email: true,
      role: true,
      isAdmin: true,
      name: true,
    },
  })

  console.table(summary)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
