import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fresques Planner",
  description: "Make a plan for your fresques",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-black/5 dark:border-white/10">
            <Link
              href="/"
              className="font-heading text-lg text-sage-dark dark:text-sage-dark tracking-wide"
            >
              🌿 Fresques Planner
            </Link>
            <ThemeToggle />
          </header>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
