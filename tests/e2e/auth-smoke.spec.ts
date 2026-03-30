import { expect, test } from "@playwright/test"

async function loginAs(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email Address").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in to Continue" }).click()
}

test.describe("auth smoke", () => {
  test("redirects unauthenticated users to login for protected routes", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login$/)

    await page.goto("/dashboard\/reports")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("renders the login page shell", async ({ page }) => {
    await page.goto("/login")

    await expect(page.getByText("Welcome to EvalWiz")).toBeVisible()
    await expect(page.getByLabel("Email Address")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
  })

  test("shows an error for invalid credentials", async ({ page }) => {
    await loginAs(page, "nobody@amrita.edu", "wrong-password")

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("Invalid email or password.")).toBeVisible()
  })
})
