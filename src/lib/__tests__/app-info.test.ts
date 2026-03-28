import { describe, it, expect } from "vitest"
import { APP_INFO, getCourseDisplayTitle } from "@/lib/app-info"

describe("APP_INFO", () => {
  it("has required fields", () => {
    expect(APP_INFO.name).toBe("EvalWiz")
    expect(APP_INFO.subjectCode).toBeTruthy()
    expect(APP_INFO.subjectTitle).toBeTruthy()
  })
})

describe("getCourseDisplayTitle", () => {
  it("returns a string combining subjectCode and subjectTitle", () => {
    const title = getCourseDisplayTitle()
    expect(title).toContain(APP_INFO.subjectCode)
    expect(title).toContain(APP_INFO.subjectTitle)
    expect(title).toBe(`${APP_INFO.subjectCode} - ${APP_INFO.subjectTitle}`)
  })
})
