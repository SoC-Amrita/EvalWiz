import { cookies } from "next/headers"

export const ANALYSIS_PREVIEW_COOKIE = "analysis-preview"
const ANALYSIS_PREVIEW_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: true,
}

export async function enableAnalysisPreviewCookie() {
  const cookieStore = await cookies()
  cookieStore.set(ANALYSIS_PREVIEW_COOKIE, "unlocked", ANALYSIS_PREVIEW_COOKIE_OPTIONS)
}

export async function hasAnalysisPreviewAccess() {
  const cookieStore = await cookies()
  return cookieStore.get(ANALYSIS_PREVIEW_COOKIE)?.value === "unlocked"
}
