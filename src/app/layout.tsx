import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { APP_INFO, getCourseDisplayTitle } from "@/lib/app-info";
import { FontProvider } from "@/components/font-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { getRootThemeBootstrapScript } from "@/lib/palette-theme";

const uiSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

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
    <html lang="en" suppressHydrationWarning className={`${uiSans.variable} h-full antialiased light`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getRootThemeBootstrapScript(),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <FontProvider>{children}</FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
