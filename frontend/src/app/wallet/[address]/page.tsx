"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImageOff, Info, OctagonAlert } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { RiskGauge } from "@/components/risk-gauge";
import { TokenAvatar } from "@/components/token-avatar";
import { WalletToolbar } from "@/components/wallet-toolbar";
import {
  getWalletNfts,
  getWalletRisks,
  getWalletSummary,
  getWalletTokens,
} from "@/lib/api";
import {
  flagTitle,
  formatAmount,
  formatRiskMessage,
  formatSol,
  humanizeError,
  riskBand,
  truncateAddress,
} from "@/lib/format";
import type {
  NftHolding,
  NftsResponse,
  RiskFlag,
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

const TOKEN_PAGE_SIZE = 50;
const NFT_PAGE_SIZE = 24;
const FLAG_PAGE_SIZE = 20;
const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };

const ANIMATE_IN = "animate-in fade-in slide-in-from-bottom-2 duration-300";

const SEVERITY_ORDER: RiskSeverity[] = ["high", "medium", "low"];

const SEVERITY_ICON_CLASS: Record<RiskSeverity, string> = {
  low: "text-muted-foreground",
  medium: "text-yellow-300",
  high: "text-red-400",
};

const SEVERITY_BAR_CLASS: Record<RiskSeverity, string> = {
  low: "bg-muted-foreground/50",
  medium: "bg-yellow-300",
  high: "bg-red-400",
};

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_GROUP_BOX: Record<RiskSeverity, string> = {
  high: "rounded-lg border border-red-400/25 bg-red-400/[0.06] p-3",
  medium: "",
  low: "",
};

function SeverityIcon({ severity }: { severity: RiskSeverity }) {
  const className = `size-4 shrink-0 ${SEVERITY_ICON_CLASS[severity]}`;
  if (severity === "high") {
    return <OctagonAlert className={className} />;
  }
  if (severity === "medium") {
    return <AlertTriangle className={className} />;
  }
  return <Info className={className} />;
}

function severityCounts(flags: RiskFlag[]): Record<RiskSeverity, number> {
  const counts: Record<RiskSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const flag of flags) {
    counts[flag.severity]++;
  }
  return counts;
}

function groupBySeverity(flags: RiskFlag[]): Partial<Record<RiskSeverity, RiskFlag[]>> {
  const groups: Partial<Record<RiskSeverity, RiskFlag[]>> = {};
  for (const flag of flags) {
    (groups[flag.severity] ??= []).push(flag);
  }
  return groups;
}

function FlagSeverityOverview({ flags }: { flags: RiskFlag[] }) {
  const counts = severityCounts(flags);
  const total = flags.length || 1;
  const present = SEVERITY_ORDER.filter((severity) => counts[severity] > 0);

  return (
    <div className="flex flex-col gap-2 pt-3">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {present.map((severity) => (
          <div
            key={severity}
            className={SEVERITY_BAR_CLASS[severity]}
            style={{ width: `${(counts[severity] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {present.map((severity) => (
          <span
            key={severity}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <span
              className={`size-1.5 rounded-full ${SEVERITY_BAR_CLASS[severity]}`}
            />
            {counts[severity]} {SEVERITY_LABEL[severity].toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className={ANIMATE_IN}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          {title}
        </CardTitle>
        <CardDescription>{humanizeError(message)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function sortTokens(tokens: TokenHolding[]): TokenHolding[] {
  return [...tokens].sort((a, b) => {
    if (a.verified !== b.verified) {
      return a.verified ? -1 : 1;
    }
    return b.amount - a.amount;
  });
}

function TokenList({ tokens }: { tokens: TokenHolding[] }) {
  const [visibleCount, setVisibleCount] = useState(TOKEN_PAGE_SIZE);
  const shown = tokens.slice(0, visibleCount);
  const remaining = tokens.length - shown.length;

  return (
    <>
      <ul className="divide-y">
        {shown.map((token, index) => (
          <li
            key={`${token.mint}-${index}`}
            className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-start gap-3">
              <TokenAvatar mint={token.mint} symbol={token.symbol} />
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
                  <CopyButton value={token.mint} label="Copy mint" iconOnly />
                </div>
                <p className="tabular-nums text-sm text-muted-foreground">
                  Amount {formatAmount(token.amount)}
                </p>
              </div>
            </div>
            <Badge variant={token.verified ? "default" : "outline"}>
              {token.verified ? "verified" : "unverified"}
            </Badge>
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="flex justify-center pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((count) => count + TOKEN_PAGE_SIZE)}
          >
            Show {Math.min(remaining, TOKEN_PAGE_SIZE)} more ({remaining} left)
          </Button>
        </div>
      )}
    </>
  );
}

function NftThumbnail({ nft }: { nft: NftHolding }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(nft.image) && !failed;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="aspect-square overflow-hidden rounded-lg bg-muted">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- NFT images come from arbitrary storage hosts, not an allowlisted set next/image can optimize
          <img
            src={nft.image}
            alt={nft.name}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageOff className="size-6 text-muted-foreground/40" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium" title={nft.name}>
          {nft.name}
        </p>
        <div className="flex items-center gap-1">
          <span
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={nft.mint}
          >
            {truncateAddress(nft.mint)}
          </span>
          <CopyButton value={nft.mint} label="Copy mint" iconOnly />
        </div>
      </div>
    </div>
  );
}

function NftGrid({ nfts }: { nfts: NftHolding[] }) {
  const [visibleCount, setVisibleCount] = useState(NFT_PAGE_SIZE);
  const shown = nfts.slice(0, visibleCount);
  const remaining = nfts.length - shown.length;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((nft, index) => (
          <NftThumbnail key={`${nft.mint}-${index}`} nft={nft} />
        ))}
      </div>
      {remaining > 0 && (
        <div className="flex justify-center pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((count) => count + NFT_PAGE_SIZE)}
          >
            Show {Math.min(remaining, NFT_PAGE_SIZE)} more ({remaining} left)
          </Button>
        </div>
      )}
    </>
  );
}

function sortFlags(flags: RiskFlag[]): RiskFlag[] {
  return [...flags].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}

function FlagGroup({
  severity,
  flags,
}: {
  severity: RiskSeverity;
  flags: RiskFlag[];
}) {
  return (
    <div className={SEVERITY_GROUP_BOX[severity]}>
      <div className="flex items-center gap-1.5 pb-1.5">
        <SeverityIcon severity={severity} />
        <span
          className={`text-xs font-semibold tracking-wide uppercase ${SEVERITY_ICON_CLASS[severity]}`}
        >
          {SEVERITY_LABEL[severity]}
        </span>
        <span className="text-xs text-muted-foreground">
          · {flags.length}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-border/60">
        {flags.map((flag, index) => (
          <li
            key={`${flag.flag_type}-${index}`}
            className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0"
          >
            <span className="text-sm font-medium">
              {flagTitle(flag.flag_type)}
            </span>
            <p className="text-sm tabular-nums text-muted-foreground">
              {formatRiskMessage(flag.message)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlagList({ flags }: { flags: RiskFlag[] }) {
  const sorted = useMemo(() => sortFlags(flags), [flags]);
  const [visibleCount, setVisibleCount] = useState(FLAG_PAGE_SIZE);
  const shown = sorted.slice(0, visibleCount);
  const remaining = sorted.length - shown.length;
  const grouped = useMemo(() => groupBySeverity(shown), [shown]);

  return (
    <>
      <div className="flex flex-col gap-4">
        {SEVERITY_ORDER.filter((severity) => grouped[severity]?.length).map(
          (severity) => (
            <FlagGroup
              key={severity}
              severity={severity}
              flags={grouped[severity]!}
            />
          ),
        )}
      </div>
      {remaining > 0 && (
        <div className="flex justify-center pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((count) => count + FLAG_PAGE_SIZE)}
          >
            Show {Math.min(remaining, FLAG_PAGE_SIZE)} more ({remaining} left)
          </Button>
        </div>
      )}
    </>
  );
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
  const [nfts, setNfts] = useState<LoadState<NftsResponse>>({
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
    void loadSection(getWalletNfts, setNfts);
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
    <>
      <WalletToolbar
        address={address}
        risk={risks.data && band ? { score: risks.data.risk_score, band } : null}
        riskLoading={risks.loading}
        onRefresh={() => setRetryKey((n) => n + 1)}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {summary.loading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3.5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        )}
        {summary.error && (
          <ErrorCard
            title="Summary"
            message={summary.error}
            onRetry={() => void loadSection(getWalletSummary, setSummary)}
          />
        )}
        {summary.data && (
          <Card className={ANIMATE_IN}>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">SOL balance</p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatSol(summary.data.sol_balance)} SOL
              </p>
            </CardContent>
          </Card>
        )}

        {risks.loading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3.5 w-32" />
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <Skeleton className="size-[88px] shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </CardContent>
          </Card>
        )}
        {risks.error && (
          <ErrorCard
            title="Risk score"
            message={risks.error}
            onRetry={() => void loadSection(getWalletRisks, setRisks)}
          />
        )}
        {risks.data && band && (
          <Card className={ANIMATE_IN}>
            <CardHeader>
              <CardTitle>Risk score</CardTitle>
              <CardDescription>Heuristic · higher means more risk</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <RiskGauge
                score={risks.data.risk_score}
                textClass={band.textClass}
                strokeColor={band.strokeColor}
              />
              <div>
                <Badge className={band.badgeClass}>{band.label} risk</Badge>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {risks.data.flags.length === 0
                    ? "No suspicious signals found."
                    : `${risks.data.flags.length} signal${risks.data.flags.length === 1 ? "" : "s"} found.`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {risks.data && risks.data.flags.length > 0 && (
        <Card className={ANIMATE_IN}>
          <CardHeader>
            <CardTitle>Risk flags</CardTitle>
            <CardDescription>
              {risks.data.flags.length} flag
              {risks.data.flags.length === 1 ? "" : "s"} worth a closer look
            </CardDescription>
            <FlagSeverityOverview flags={risks.data.flags} />
          </CardHeader>
          <CardContent>
            <FlagList
              key={`${address}-${retryKey}`}
              flags={risks.data.flags}
            />
          </CardContent>
        </Card>
      )}

      {tokens.loading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3.5 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {tokens.error && (
        <ErrorCard
          title="Tokens"
          message={tokens.error}
          onRetry={() => void loadSection(getWalletTokens, setTokens)}
        />
      )}
      {tokens.data && (
        <Card className={ANIMATE_IN}>
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
              <TokenList
                key={`${address}-${retryKey}-${tokenFilter}`}
                tokens={visibleTokens}
              />
            )}
          </CardContent>
        </Card>
      )}

      {nfts.loading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3.5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {nfts.error && (
        <ErrorCard
          title="NFTs"
          message={nfts.error}
          onRetry={() => void loadSection(getWalletNfts, setNfts)}
        />
      )}
      {nfts.data && nfts.data.nfts.length > 0 && (
        <Card className={ANIMATE_IN}>
          <CardHeader>
            <CardTitle>NFTs</CardTitle>
            <CardDescription>
              {nfts.data.nfts.length} holding
              {nfts.data.nfts.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NftGrid key={`${address}-${retryKey}`} nfts={nfts.data.nfts} />
          </CardContent>
        </Card>
      )}
      </main>
    </>
  );
}
