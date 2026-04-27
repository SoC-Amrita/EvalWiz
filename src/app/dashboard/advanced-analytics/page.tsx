import { redirect } from "next/navigation"

export default async function AdvancedAnalyticsPage() {
  redirect("/dashboard/analytics?tab=advanced")
}
