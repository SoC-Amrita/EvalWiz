import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="relative flex min-h-screen overflow-hidden app-shell">
      <div className="pointer-events-none absolute inset-0 app-grid opacity-60" />

      {/* Sidebar */}
      <aside className="relative z-10 hidden w-64 flex-col border-r border-border/80 bg-background/85 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 border-b border-border/80 p-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="px-6 py-3">
          <Skeleton className="h-3 w-28" />
        </div>
        <nav className="flex-1 space-y-2 px-4 py-6">
          <Skeleton className="mb-3 ml-2 h-3 w-16" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full rounded-md" />
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex h-16 items-center justify-between border-b border-border/80 bg-background/78 px-4 backdrop-blur-xl md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-md md:hidden" />
            <Skeleton className="h-4 w-48 max-w-[68vw]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden space-y-1.5 sm:block">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-foreground/10"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
              <Skeleton className="mb-6 h-5 w-40" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
