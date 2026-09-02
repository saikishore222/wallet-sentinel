"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { RiskBand } from "@/lib/format";
import { truncateAddress } from "@/lib/format";
import { isValidSolanaAddress } from "@/lib/solana";

type WalletToolbarProps = {
  address: string;
  risk: { score: number; band: RiskBand } | null;
  riskLoading: boolean;
  onRefresh: () => void;
};

export function WalletToolbar({
  address,
  risk,
  riskLoading,
  onRefresh,
}: WalletToolbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    if (!isValidSolanaAddress(trimmed)) {
      setError(true);
      return;
    }
    setError(false);
    setQuery("");
    router.push(`/wallet/${trimmed}`);
  }

  return (
    <div className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-mono text-sm" title={address}>
            {truncateAddress(address, 6, 6)}
          </span>
          <CopyButton value={address} label="Copy address" iconOnly />
        </div>

        {riskLoading && <Skeleton className="h-5 w-24 rounded-full" />}
        {risk && (
          <Badge className={risk.band.badgeClass}>
            {risk.band.label} · {risk.score}/100
          </Badge>
        )}

        <form
          onSubmit={onSearch}
          className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:max-w-xs"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (error) setError(false);
              }}
              placeholder="Check another wallet…"
              aria-label="Check another wallet address"
              aria-invalid={error ? true : undefined}
              className="h-8 pl-8 font-mono text-xs"
            />
          </div>
        </form>

        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={onRefresh}
          aria-label="Refresh"
        >
          <RefreshCw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
