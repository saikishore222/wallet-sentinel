import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ShieldHalf } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import "./globals.css";

const NAV_LINKS = [
  { href: "/#coverage", label: "Threats" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#vs-explorers", label: "Vs. explorers" },
  { href: "/#under-the-hood", label: "API" },
];

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wallet Sentinel",
  description: "Inspect Solana wallet balances, tokens, and risk flags",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium">
              <ShieldHalf className="size-4 text-primary" />
              Wallet Sentinel
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              {NAV_LINKS.map((link) => (
                // Plain anchors, not next/link: these jump to a hash on the
                // same page, and Next's client-side router doesn't reliably
                // scroll to an in-page anchor when there's no route change.
                <a
                  key={link.href}
                  href={link.href}
                  className="hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hash anchor, not a page link; see note above */}
            <a
              href="/#scan"
              className={buttonVariants({ size: "sm", className: "ml-auto" })}
            >
              Scan a wallet
            </a>
          </div>
        </header>
        {children}
        <footer className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
            <span>Wallet Sentinel</span>
            <span>Heuristic signals, not financial advice.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
