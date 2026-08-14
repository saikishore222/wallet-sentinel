"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { getWalletRisks, getWalletSummary, getWalletTokens } from "@/lib/api";
import {
  flagTitle,
  formatAmount,
  formatRiskMessage,
  formatSol,
  riskBand,
  truncateAddress,
} from "@/lib/format";
import type {
  RiskSeverity,
  RisksResponse,
  TokenHolding,
  TokensResponse,
  WalletSummary,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LoadState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

type TokenFilter = "all" | "verified" | "unverified";

function severityClass(severity: RiskSeverity): string {
  switch (severity) {
    case "low":
      return "bg-zinc-200 text-zinc-800";
    case "medium":
      return "bg-yellow-200 text-yellow-900";
    case "high":
      return "bg-red-200 text-red-900";
  }
}

function sortTokens(tokens: TokenHolding[]): TokenHolding[] {
  return [...tokens].sort((a, b) => {
    if (a.verified !== b.verified) {
      return a.verified ? -1 : 1;
    }
    return b.amount - a.amount;
  });
}

export default function WalletPage() {
  const params = useParams<{ address: string }>();
  const address = decodeURIComponent(params.address);

  const [summary, setSummary] = useState<LoadState<WalletSummary>>({
    data: null,
    error: null,
    loading: true,
  });
  const [tokens, setTokens] = useState<LoadState<TokensResponse>>({
    data: null,
    error: null,
    loading: true,
  });
  const [risks, setRisks] = useState<LoadState<RisksResponse>>({
    data: null,
    error: null,
    loading: true,
  });
  const [retryKey, setRetryKey] = useState(0);
  const [tokenFilter, setTokenFilter] = useState<TokenFilter>("all");

  const loadSection = useCallback(
    async function loadSection<T>(
      fetcher: (address: string) => Promise<T>,
      setter: (state: LoadState<T>) => void,
    ) {
      setter({ data: null, error: null, loading: true });
      try {
        const data = await fetcher(address);
        setter({ data, error: null, loading: false });
      } catch (err) {
        setter({
          data: null,
          error: err instanceof Error ? err.message : "Failed to load",
          loading: false,
        });
      }
    },
    [address],
  );

  useEffect(() => {
    void loadSection(getWalletSummary, setSummary);
    void loadSection(getWalletTokens, setTokens);
    void loadSection(getWalletRisks, setRisks);
  }, [loadSection, retryKey]);

  const holdings = tokens.data?.tokens ?? [];
  const verifiedCount = holdings.filter((token) => token.verified).length;
  const unverifiedCount = holdings.length - verifiedCount;

  const visibleTokens = useMemo(() => {
    const sorted = sortTokens(holdings);
    if (tokenFilter === "verified") {
      return sorted.filter((token) => token.verified);
    }
    if (tokenFilter === "unverified") {
      return sorted.filter((token) => !token.verified);
    }
    return sorted;
  }, [holdings, tokenFilter]);

  const band = risks.data ? riskBand(risks.data.risk_score) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Wallet analysis</h1>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setRetryKey((n) => n + 1)}>
            Retry
          </Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            New search
          </Button>
        </div>
      </div>

      {summary.loading && <Skeleton className="h-28 w-full" />}
      {summary.error && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>{summary.error}</CardDescription>
          </CardHeader>
        </Card>
      )}
      {summary.data && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription className="flex items-center justify-between gap-2">
              <span className="font-mono" title={summary.data.address}>
                {truncateAddress(summary.data.address, 6, 6)}
              </span>
              <CopyButton value={summary.data.address} label="Copy address" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">SOL balance</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatSol(summary.data.sol_balance)} SOL
            </p>
          </CardContent>
        </Card>
      )}

      {tokens.loading && <Skeleton className="h-40 w-full" />}
      {tokens.error && (
        <Card>
          <CardHeader>
            <CardTitle>Tokens</CardTitle>
            <CardDescription>{tokens.error}</CardDescription>
          </CardHeader>
        </Card>
      )}
      {tokens.data && (
        <Card>
          <CardHeader>
            <CardTitle>Tokens</CardTitle>
            <CardDescription>
              {holdings.length} holding{holdings.length === 1 ? "" : "s"}
              {holdings.length > 0
                ? ` · ${verifiedCount} verified · ${unverifiedCount} unverified`
                : ""}
            </CardDescription>
            {holdings.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {(
                  [
                    ["all", `All (${holdings.length})`],
                    ["verified", `Verified (${verifiedCount})`],
                    ["unverified", `Unverified (${unverifiedCount})`],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={tokenFilter === value ? "default" : "outline"}
                    onClick={() => setTokenFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {holdings.length === 0 ? (
              <p className="text-muted-foreground">No tokens found.</p>
            ) : visibleTokens.length === 0 ? (
              <p className="text-muted-foreground">No tokens in this filter.</p>
            ) : (
              <ul className="divide-y">
                {visibleTokens.map((token) => (
                  <li
                    key={token.mint}
                    className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {token.symbol ?? "Unknown token"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs text-muted-foreground"
                          title={token.mint}
                        >
                          {truncateAddress(token.mint)}
                        </span>
                        <CopyButton
                          value={token.mint}
                          label="Copy mint"
                          iconOnly
                        />
                      </div>
                      <p className="tabular-nums text-sm text-muted-foreground">
                        Amount {formatAmount(token.amount)}
                      </p>
                    </div>
                    <Badge variant={token.verified ? "default" : "outline"}>
                      {token.verified ? "verified" : "unverified"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {risks.loading && <Skeleton className="h-40 w-full" />}
      {risks.error && (
        <Card>
          <CardHeader>
            <CardTitle>Risk flags</CardTitle>
            <CardDescription>{risks.error}</CardDescription>
          </CardHeader>
        </Card>
      )}
      {risks.data && band && (
        <Card>
          <CardHeader>
            <CardTitle>Risk flags</CardTitle>
            <CardDescription>
              Heuristic score · higher means more risk · {risks.data.flags.length}{" "}
              flag{risks.data.flags.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold tabular-nums ${band.className}`}>
              {risks.data.risk_score}
              <span className="text-base font-medium text-muted-foreground">
                {" "}
                / 100
              </span>
            </p>
            <p className="mb-4 text-sm text-muted-foreground">{band.label} risk</p>
            {risks.data.flags.length === 0 ? (
              <p className="text-muted-foreground">No risk flags.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {risks.data.flags.map((flag, index) => (
                  <li
                    key={`${flag.flag_type}-${index}`}
                    className="flex flex-col gap-1"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={severityClass(flag.severity)}>
                        {flag.severity}
                      </Badge>
                      <span className="text-sm font-medium">
                        {flagTitle(flag.flag_type)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatRiskMessage(flag.message)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
