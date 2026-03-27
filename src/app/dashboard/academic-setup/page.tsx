import { auth } from "@/auth"
import { redirect } from "next/navigation"

import { AcademicSetupClient } from "./client"
import { getAcademicSetupData } from "./data"

export default async function AcademicSetupPage() {
  const session = await auth()
  if (!session?.user?.isAdmin) {
    redirect("/dashboard")
  }

  const { subjects, classes, offerings } = await getAcademicSetupData()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Academic Setup
        </h1>
        <p className="text-slate-500">
          Create reusable subjects, manage roll-aware class rosters, and publish course offerings with mentor and faculty assignments. Roll-number metadata belongs to reusable classes only, not to subjects.
        </p>
      </div>

      <AcademicSetupClient
        subjects={subjects}
        classes={classes}
        offerings={offerings}
      />
    </div>
  )
}
