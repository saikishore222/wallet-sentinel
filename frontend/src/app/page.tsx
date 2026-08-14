"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isValidSolanaAddress } from "@/lib/solana";

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
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Wallet Sentinel</CardTitle>
          <CardDescription>
            Enter a Solana wallet address to inspect balance, tokens, and risk
            flags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Solana wallet address"
                aria-label="Solana wallet address"
                aria-invalid={error ? true : undefined}
                className="font-mono"
              />
              <Button type="submit">Check Wallet</Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
