import { describe, it, expect } from "vitest"
import { getErrorMessage } from "@/lib/client-errors"

describe("getErrorMessage", () => {
  it("returns the Error message when error is an Error instance", () => {
    const error = new Error("something went wrong")
    expect(getErrorMessage(error, "fallback")).toBe("something went wrong")
  })

  it("returns the fallback when error is a plain string", () => {
    expect(getErrorMessage("oops", "fallback")).toBe("fallback")
  })

  it("returns the fallback when error is null", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback")
  })

  it("returns the fallback when error is undefined", () => {
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback")
  })

  it("returns the fallback when error is a number", () => {
    expect(getErrorMessage(42, "fallback")).toBe("fallback")
  })

  it("returns the fallback when error is a plain object", () => {
    expect(getErrorMessage({ message: "nope" }, "fallback")).toBe("fallback")
  })

  it("works with custom Error subclasses", () => {
    class CustomError extends Error {}
    const error = new CustomError("custom message")
    expect(getErrorMessage(error, "fallback")).toBe("custom message")
  })
})
