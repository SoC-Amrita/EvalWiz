import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Purging all Marks...")
  await prisma.mark.deleteMany({})

  console.log("Purging all Students...")
  const deletedCount = await prisma.student.deleteMany({})

  console.log(`Successfully purged ${deletedCount.count} students and their associated marks!`)
  console.log("You can now import your real students from the CSV on the dashboard.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
