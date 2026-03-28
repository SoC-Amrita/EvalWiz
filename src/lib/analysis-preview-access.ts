import { cookies } from "next/headers"

export const ANALYSIS_PREVIEW_COOKIE = "analysis-preview"

export async function enableAnalysisPreviewCookie() {
  const cookieStore = await cookies()
  cookieStore.set(ANALYSIS_PREVIEW_COOKIE, "unlocked", {
    path: "/",
    sameSite: "lax",
  })
}

export async function hasAnalysisPreviewAccess() {
  const cookieStore = await cookies()
  return cookieStore.get(ANALYSIS_PREVIEW_COOKIE)?.value === "unlocked"
}
