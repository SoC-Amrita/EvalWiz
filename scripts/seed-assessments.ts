import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Emptying old assessments and marks...")
  await prisma.mark.deleteMany({})
  await prisma.assessment.deleteMany({})

  console.log("Creating new specific 23CSE311 assessments...")

  const assessments = [
    {
      name: "Online Quiz 1",
      code: "QZ1",
      category: "QUIZ",
      maxMarks: 10,
      weightage: 5,
      displayOrder: 1,
      isActive: true,
      includeInAgg: true,
    },
    {
      name: "Online Quiz 2",
      code: "QZ2",
      category: "QUIZ",
      maxMarks: 10,
      weightage: 5,
      displayOrder: 2,
      isActive: true,
      includeInAgg: true,
    },
    {
      name: "Sprint 0",
      code: "SP0",
      category: "ASSIGNMENT",
      maxMarks: 10,
      weightage: 10,
      displayOrder: 3,
      isActive: true,
      includeInAgg: true,
    },
    {
      name: "Sprint 1",
      code: "SP1",
      category: "ASSIGNMENT",
      maxMarks: 30,
      weightage: 15,
      displayOrder: 4,
      isActive: true,
      includeInAgg: true,
    },
    {
      name: "Sprint 2",
      code: "SP2",
      category: "ASSIGNMENT",
      maxMarks: 30,
      weightage: 15,
      displayOrder: 5,
      isActive: true,
      includeInAgg: true,
    },
    {
      name: "MidTerms",
      code: "MID",
      category: "INTERNAL",
      maxMarks: 50,
      weightage: 20,
      displayOrder: 6,
      isActive: true,
      includeInAgg: true,
    },
    {
      name: "End Semester",
      code: "END",
      category: "END_SEM",
      maxMarks: 50,
      weightage: 30,
      displayOrder: 7,
      isActive: true,
      includeInAgg: true,
    }
  ]

  for (const a of assessments) {
    await prisma.assessment.create({
      data: a
    })
  }

  console.log("Successfully seeded specific components!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
