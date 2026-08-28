import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ShieldHalf } from "lucide-react";
import "./globals.css";

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
          <div className="mx-auto flex w-full max-w-5xl items-center px-6 py-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium">
              <ShieldHalf className="size-4 text-primary" />
              Wallet Sentinel
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
