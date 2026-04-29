import { AssessmentComponentType, PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

const prisma = new PrismaClient()

function buildNameFields(title: string, firstName: string, lastName: string) {
  return {
    title,
    firstName,
    lastName,
    name: `${title} ${firstName} ${lastName}`,
  }
}

function resolveSeedPassword(envVar: string) {
  return process.env[envVar]?.trim() || randomBytes(12).toString("base64url")
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run seed")
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function createAuthUser(admin: ReturnType<typeof getSupabaseAdmin>, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`Failed to create auth user ${email}: ${error?.message}`)
  return data.user.id
}

async function main() {
  const admin = getSupabaseAdmin()

  // Wipe existing Supabase auth users that match seed emails before re-seeding.
  const seedEmails = [
    'admin@amrita.edu',
    'mentor1@amrita.edu', 'mentor2@amrita.edu',
    'fac1@amrita.edu', 'fac2@amrita.edu', 'fac3@amrita.edu',
    'fac4@amrita.edu', 'fac5@amrita.edu', 'fac6@amrita.edu',
  ]
  const { data: existingAuthUsers } = await admin.auth.admin.listUsers()
  for (const u of existingAuthUsers?.users ?? []) {
    if (seedEmails.includes(u.email ?? '')) {
      await admin.auth.admin.deleteUser(u.id)
    }
  }

  // Clear existing Prisma data
  await prisma.auditLog.deleteMany()
  await prisma.mark.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.courseOfferingMentor.deleteMany()
  await prisma.courseOfferingClass.deleteMany()
  await prisma.courseOffering.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.student.deleteMany()
  await prisma.section.deleteMany()
  await prisma.faculty.deleteMany()
  await prisma.user.deleteMany()

  console.log('Database cleared.')

  const adminPlaintextPassword = resolveSeedPassword("SEED_ADMIN_PASSWORD")
  const facultyPlaintextPassword = resolveSeedPassword("SEED_FACULTY_PASSWORD")

  // Admin user
  const adminSupabaseId = await createAuthUser(admin, 'admin@amrita.edu', adminPlaintextPassword)
  const adminUser = await prisma.user.create({
    data: {
      supabaseId: adminSupabaseId,
      ...buildNameFields('Dr.', 'Anita', 'Raman'),
      email: 'admin@amrita.edu',
      role: 'FACULTY',
      isAdmin: true,
      faculty: { create: { name: 'Dr. Anita Raman' } },
    },
  })

  // Faculty / mentor users
  const facultyData = [
    { email: 'mentor1@amrita.edu', title: 'Dr.',   firstName: 'Malathi',  lastName: 'P',             isMentor: true },
    { email: 'mentor2@amrita.edu', title: 'Prof.', firstName: 'Krishna',  lastName: 'Priya',         isMentor: true },
    { email: 'fac1@amrita.edu',    title: 'Dr.',   firstName: 'Anisha',   lastName: 'Radhakrishnan', isMentor: false },
    { email: 'fac2@amrita.edu',    title: 'Dr.',   firstName: 'Vedaj',    lastName: 'Padman',        isMentor: false },
    { email: 'fac3@amrita.edu',    title: 'Dr.',   firstName: 'Suchithra',lastName: 'M',             isMentor: false },
    { email: 'fac4@amrita.edu',    title: 'Prof.', firstName: 'Senthil',  lastName: 'Kumar',         isMentor: false },
    { email: 'fac5@amrita.edu',    title: 'Dr.',   firstName: 'Aparna',   lastName: 'Nair',          isMentor: false },
    { email: 'fac6@amrita.edu',    title: 'Prof.', firstName: 'Rohit',    lastName: 'Menon',         isMentor: false },
  ]

  const facultyRecords = []
  const mentorUserIds: string[] = [adminUser.id]

  for (const f of facultyData) {
    const supabaseId = await createAuthUser(admin, f.email, facultyPlaintextPassword)
    const user = await prisma.user.create({
      data: {
        supabaseId,
        ...buildNameFields(f.title, f.firstName, f.lastName),
        email: f.email,
        role: 'FACULTY',
        isAdmin: false,
        faculty: { create: { name: `${f.title} ${f.firstName} ${f.lastName}` } },
      },
      include: { faculty: true },
    })
    facultyRecords.push(user.faculty!)
    if (f.isMentor) mentorUserIds.push(user.id)
  }

  const subject = await prisma.subject.create({
    data: { code: '23CSE311', title: 'Software Engineering', program: 'BTech CSE', isActive: true },
  })

  const sectionMappings = [
    { name: 'Section A', sectionCode: 'A', facultyId: facultyRecords[2].id },
    { name: 'Section B', sectionCode: 'B', facultyId: facultyRecords[2].id },
    { name: 'Section C', sectionCode: 'C', facultyId: facultyRecords[3].id },
    { name: 'Section D', sectionCode: 'D', facultyId: facultyRecords[3].id },
    { name: 'Section E', sectionCode: 'E', facultyId: facultyRecords[4].id },
    { name: 'Section F', sectionCode: 'F', facultyId: facultyRecords[5].id },
    { name: 'Section G', sectionCode: 'G', facultyId: facultyRecords[6].id },
    { name: 'Section H', sectionCode: 'H', facultyId: facultyRecords[7].id },
  ]

  const sections = []
  for (const s of sectionMappings) {
    const section = await prisma.section.create({
      data: {
        name: s.name, facultyId: s.facultyId,
        rollPrefix: 'CB', schoolCode: 'SC', levelCode: 'U',
        programDurationYears: 4, programCode: 'CSE',
        admissionYear: '2023', expectedGraduationYear: '2027',
        sectionCode: s.sectionCode, program: 'BTech CSE',
        semester: 'VI', year: 'III', isActive: true,
      },
    })
    sections.push(section)
  }

  const offering = await prisma.courseOffering.create({
    data: {
      subjectId: subject.id, term: 'Even / Winter', academicYear: '2025 - 2026',
      semester: 'VI', year: 'III', evaluationPattern: '70 - 30',
      courseType: 'Theory', isElective: false, isActive: true,
    },
  })

  await prisma.courseOfferingClass.createMany({
    data: sections.map((section, i) => ({
      offeringId: offering.id, sectionId: section.id, facultyId: sectionMappings[i].facultyId,
    })),
  })

  await prisma.courseOfferingMentor.createMany({
    data: mentorUserIds.map((userId) => ({ offeringId: offering.id, userId })),
  })

  const students = []
  for (const [sectionIndex, section] of sections.entries()) {
    for (let i = 1; i <= 60; i++) {
      const student = await prisma.student.create({
        data: {
          rollNo: `CB.SC.U4CSE23${sectionIndex}${String(i).padStart(2, '0')}`,
          name: `Student ${i} of ${section.name}`,
          sectionId: section.id,
        },
      })
      students.push(student)
    }
  }

  const assessments = [
    { name: 'Midterm Exam',        code: 'MIDTERM',  maxMarks: 50,  weightage: 20, category: 'MID_TERM',     componentType: AssessmentComponentType.INTERNAL, displayOrder: 1 },
    { name: 'Lab Assignment 1',    code: 'LAB1',     maxMarks: 10,  weightage: 5,  category: 'CA_REVIEW',    componentType: AssessmentComponentType.INTERNAL, displayOrder: 2 },
    { name: 'End Semester Exam',   code: 'END_SEM',  maxMarks: 100, weightage: 50, category: 'END_SEMESTER', componentType: AssessmentComponentType.EXTERNAL, displayOrder: 3 },
  ]

  const createdAssessments = []
  for (const a of assessments) {
    createdAssessments.push(await prisma.assessment.create({ data: { ...a, offeringId: offering.id } }))
  }

  for (const student of students) {
    for (const assessment of createdAssessments) {
      await prisma.mark.create({
        data: { marks: Math.floor(Math.random() * (assessment.maxMarks + 1)), studentId: student.id, assessmentId: assessment.id },
      })
    }
  }

  console.log('Seed completed successfully.')
  console.log(`Admin password: ${adminPlaintextPassword}`)
  console.log(`Faculty/mentor password: ${facultyPlaintextPassword}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
