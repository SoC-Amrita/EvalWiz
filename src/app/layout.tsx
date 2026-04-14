import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { APP_INFO, getCourseDisplayTitle } from "@/lib/app-info";
import { FontProvider } from "@/components/font-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getRootThemeBootstrapScript } from "@/lib/palette-theme";

export const metadata: Metadata = {
  title: APP_INFO.name,
  description: `${APP_INFO.name} for ${getCourseDisplayTitle()}, developed by ${APP_INFO.developer}.`,
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased light">
      <head>
        <Script id="root-theme-bootstrap" strategy="beforeInteractive">
          {getRootThemeBootstrapScript()}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <FontProvider>{children}</FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
