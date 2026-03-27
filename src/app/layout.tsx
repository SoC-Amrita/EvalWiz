import type { Metadata } from "next";
import "./globals.css";
import { APP_INFO, getCourseDisplayTitle } from "@/lib/app-info";
import { FontProvider } from "@/components/font-provider";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: APP_INFO.name,
  description: `${APP_INFO.name} for ${getCourseDisplayTitle()}, developed by ${APP_INFO.developer}.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <FontProvider>{children}</FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
