import { redirect } from "next/navigation"

export default async function ReportsPage() {
  redirect("/dashboard/analytics?tab=reports")
}
