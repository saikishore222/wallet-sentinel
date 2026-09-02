"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  ArrowRight,
  Check,
  Coins,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidSolanaAddress } from "@/lib/solana";

const FEATURES = [
  {
    icon: Wallet,
    title: "Balances & holdings",
    description:
      "SOL balance plus every SPL, Token-2022, and NFT holding, in one lookup.",
  },
  {
    icon: Coins,
    title: "Verified vs. unverified",
    description:
      "See which tokens carry a known mint registry entry and which don't.",
  },
  {
    icon: ShieldAlert,
    title: "Heuristic risk flags",
    description:
      "A scored signal for suspicious mint activity, so you know what to double-check.",
  },
  {
    icon: Fingerprint,
    title: "Address poisoning detection",
    description:
      "Catches dust sent from lookalike addresses designed to trick your next copy-paste.",
  },
];

const COMPARISON = [
  {
    generic: "Every token account listed, unranked",
    sentinel: "One score, Low to Critical, and why it landed there",
  },
  {
    generic: "“Verified” badges are inconsistent or missing",
    sentinel: "Every token checked against Jupiter's strict list",
  },
  {
    generic: "Dust from a lookalike address blends right in",
    sentinel: "Address poisoning attempts called out by name",
  },
  {
    generic: "Built for transaction forensics",
    sentinel: "Built to answer one question: can I trust this wallet?",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError("Enter a Solana wallet address.");
      return;
    }
    if (!isValidSolanaAddress(trimmed)) {
      setError("That does not look like a valid Solana address.");
      return;
    }
    setError(null);
    router.push(`/wallet/${trimmed}`);
  }

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[28rem] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_28%,transparent),transparent)] blur-2xl"
      />

      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Read-only · no wallet connection required
        </div>

        <div className="flex flex-col gap-4">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Know what&apos;s really in a{" "}
            <span className="text-primary">Solana wallet</span>
          </h1>
          <p className="text-balance text-base text-muted-foreground sm:text-lg">
            Paste any address to inspect its SOL balance, SPL, Token-2022 &amp;
            NFT holdings, and heuristic risk flags — before you trust it.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex w-full max-w-xl flex-col gap-2">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/80 p-2 shadow-lg shadow-black/20 backdrop-blur sm:flex-row">
            <Input
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter a Solana wallet address…"
              aria-label="Solana wallet address"
              aria-invalid={error ? true : undefined}
              className="h-11 flex-1 border-0 bg-transparent px-3 font-mono text-sm focus-visible:ring-0"
            />
            <Button type="submit" size="lg" className="h-11 gap-1.5 px-5">
              Check wallet
              <ArrowRight className="size-4" />
            </Button>
          </div>
          {error && (
            <p className="text-left text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card/50 p-4 text-left"
            >
              <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>

        <div className="flex w-full flex-col items-center gap-6 border-t border-border pt-14">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Not another explorer
            </h2>
            <p className="text-balance text-muted-foreground">
              Explorers show you data. Wallet Sentinel tells you what it
              means.
            </p>
          </div>

          <div className="w-full overflow-hidden rounded-2xl border border-border bg-card/50 text-left">
            <div className="grid grid-cols-2 border-b border-border text-xs font-medium sm:text-sm">
              <div className="px-4 py-3 text-muted-foreground sm:px-6">
                Typical explorer
              </div>
              <div className="border-l border-border px-4 py-3 text-primary sm:px-6">
                Wallet Sentinel
              </div>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.sentinel}
                className="grid grid-cols-2 border-b border-border last:border-0"
              >
                <div className="flex items-start gap-2 px-4 py-3.5 text-xs text-muted-foreground sm:px-6 sm:text-sm">
                  <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                  <span>{row.generic}</span>
                </div>
                <div className="flex items-start gap-2 border-l border-border px-4 py-3.5 text-xs sm:px-6 sm:text-sm">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{row.sentinel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
