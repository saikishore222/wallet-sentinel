"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Coins, ShieldAlert, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidSolanaAddress } from "@/lib/solana";

const FEATURES = [
  {
    icon: Wallet,
    title: "Balances & holdings",
    description:
      "SOL balance plus every SPL and Token-2022 holding, in one lookup.",
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
            Paste any address to inspect its SOL balance, SPL &amp; Token-2022
            holdings, and heuristic risk flags — before you trust it.
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

        <div className="grid w-full gap-4 sm:grid-cols-3">
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
      </div>
    </main>
  );
}
