"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { loginAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen } from "lucide-react"
import { APP_INFO } from "@/lib/app-info"

export default function LoginPage() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    try {
      const result = await loginAction(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-amrita relative min-h-screen overflow-hidden app-shell">
      <div className="pointer-events-none absolute inset-0 app-grid opacity-70" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center py-8">
          <section className="flex w-full items-center justify-center">
            <Card className="w-full max-w-xl rounded-[2rem] app-panel border-none shadow-2xl">
                <CardHeader className="space-y-5 pb-2">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-[linear-gradient(135deg,var(--primary),color-mix(in_srgb,var(--chart-2)_74%,white))] text-primary-foreground shadow-xl shadow-primary/25">
                      <BookOpen className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                        {APP_INFO.name}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="text-3xl tracking-tight text-foreground">Welcome back</CardTitle>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      Sign in with your institutional credentials to continue.
                    </CardDescription>
                  </div>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-5 pt-4">
                    {error && (
                      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-300">
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-foreground">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="h-12 rounded-2xl border-border bg-background/80 px-4 text-base"
                        placeholder="faculty@amrita.edu"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium text-foreground">
                        Password
                      </Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="h-12 rounded-2xl border-border bg-background/80 px-4 text-base"
                        placeholder="Enter your password"
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4 pt-2">
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                      disabled={loading}
                    >
                      {loading ? "Signing in..." : "Sign in to Continue"}
                    </Button>
                    <p className="text-center text-xs leading-5 text-muted-foreground">
                      {APP_INFO.institution}
                    </p>
                  </CardFooter>
                </form>
              </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
