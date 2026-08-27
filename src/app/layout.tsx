import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/shell/AppShell";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

/**
 * The markup ships the dark default, so this only has to apply a stored choice
 * — before first paint, so a light-mode user never sees a frame of the dark
 * palette. It repeats the rule in `resolveTheme` because it must run before any
 * module loads.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(s==='light'||s==='dark'){document.documentElement.dataset.theme=s;}}catch(e){}})();`;

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Northwind Internal Tools",
  description: "Internal operations tooling for compliance and platform teams.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-theme={DEFAULT_THEME}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
