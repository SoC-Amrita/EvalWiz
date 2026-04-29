import { getSessionUser } from "@/lib/session"
import { redirect } from "next/navigation"

import { getAcademicSetupData } from "../../data"
import { OfferingFormPage } from "../../offering-form"

export default async function NewOfferingPage() {
  const user = await getSessionUser()
  if (!user?.isAdmin) {
    redirect("/dashboard")
  }

  const { subjects, classes, facultyMembers, mentors } = await getAcademicSetupData()

  return (
    <OfferingFormPage
      mode="create"
      subjects={subjects}
      classes={classes}
      facultyMembers={facultyMembers}
      mentors={mentors}
    />
  )
}
