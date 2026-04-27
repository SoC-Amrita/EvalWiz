import { redirect } from "next/navigation"

// Compatibility redirect: advanced analytics was merged into the analytics tab view.
// The data and component logic still live in this directory and are imported by
// analytics/page.tsx, grading/page.tsx, and grading/stem-leaf/page.tsx.
export default async function AdvancedAnalyticsPage() {
  redirect("/dashboard/analytics?tab=advanced")
}
