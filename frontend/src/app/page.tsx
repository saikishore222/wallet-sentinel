"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { RiskGauge } from "@/components/risk-gauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { riskBand } from "@/lib/format";
import { isValidSolanaAddress } from "@/lib/solana";

type Severity = "critical" | "high" | "medium" | "coverage";

const SEVERITY_TAG_CLASS: Record<Severity, string> = {
  critical: "bg-red-400/15 text-red-400",
  high: "bg-orange-400/15 text-orange-400",
  medium: "bg-yellow-300/15 text-yellow-300",
  coverage: "bg-muted text-muted-foreground",
};

const COVERAGE: {
  number: string;
  severity: Severity;
  title: string;
  description: string;
}[] = [
  {
    number: "01",
    severity: "critical",
    title: "Address poisoning",
    description:
      "A near-zero transfer from an address that shares the first and last characters of one you already trust, betting you'll copy the wrong line out of your history later. Most explorers don't check for this at all.",
  },
  {
    number: "02",
    severity: "high",
    title: "Compressed NFT spam",
    description:
      "There's no trusted list for NFT collections, so this one goes sideways: compressed NFTs cost a fraction of a cent, which is why mass airdrop spam is almost always compressed. Compressed and never sold on a marketplace gets flagged.",
  },
  {
    number: "03",
    severity: "high",
    title: "Fake-value spam tokens",
    description:
      "Balances sized to look valuable at a glance, from creators who airdropped thousands of wallets the same day.",
  },
  {
    number: "04",
    severity: "medium",
    title: "Unverified SPL mints",
    description:
      "Every holding checked against the Jupiter token list. Anything missing gets called out instead of sitting in the list looking legitimate.",
  },
  {
    number: "05",
    severity: "medium",
    title: "Dust flooding",
    description:
      "Sub-cent transfers scattered across a wallet to pad out the account list, track the owner, or bait an interaction.",
  },
  {
    number: "06",
    severity: "coverage",
    title: "Token-2022 holdings",
    description:
      "Token-2022 accounts get read and scored alongside SPL, so newer mints don't slip past the same checks.",
  },
];

const SAMPLE_FINDINGS: {
  title: string;
  message: string;
  tag: string;
  tagClass: string;
}[] = [
  {
    title: "Address poisoning attempt",
    message:
      "0.000001 SOL from 9fRkQ2wv…8sLm2Vx, mimicking your counterparty 9fRkPt3d…yEnm2Vx",
    tag: "POISON",
    tagClass: SEVERITY_TAG_CLASS.critical,
  },
  {
    title: "31 unverified mints",
    message: "Not present in the Jupiter token list",
    tag: "UNVERIFIED",
    tagClass: SEVERITY_TAG_CLASS.high,
  },
  {
    title: "Spam balance inflation",
    message: "4 mints hold quantities sized to look valuable at a glance",
    tag: "SPAM",
    tagClass: SEVERITY_TAG_CLASS.medium,
  },
  {
    title: "17 dust deposits",
    message: "Unsolicited sub-cent transfers across 9 unknown mints",
    tag: "DUST",
    tagClass: SEVERITY_TAG_CLASS.coverage,
  },
];

const SCENARIOS: { label: string; score: number; lines: string[] }[] = [
  {
    label: "Clean wallet",
    score: 0,
    lines: [
      "SOL, USDC and JUP all resolve cleanly",
      "All mints verified · no lookalike senders",
      "Zero unsolicited transfers in the scanned window",
    ],
  },
  {
    label: "Poisoned wallet",
    score: 88,
    lines: [
      "0.000001 SOL from 9fRkQ2wv…8sLm2Vx, mimicking your counterparty 9fRkPt3d…yEnm2Vx",
      "Address poisoning caught, with the address it mimics",
      "Dust from a lookalike address blends right in — for everyone else",
    ],
  },
  {
    label: "NFT-spam wallet",
    score: 62,
    lines: [
      "23 unverified NFTs · 11 unverified mints",
      "6 mints share a creator that batch-airdropped thousands of wallets",
      "Compressed and never traded, so flagged unverified",
    ],
  },
];

const HOW_IT_WORKS: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Paste an address",
    description:
      "Paste a Solana wallet address. No wallet connection, nothing to sign.",
  },
  {
    step: "02",
    title: "What's in it",
    description:
      "SOL balance, every SPL and Token-2022 holding, every NFT, and the inbound transfers. Read-only, straight from Helius.",
  },
  {
    step: "03",
    title: "What's verified",
    description:
      "Tokens checked against the Jupiter list. NFTs checked on compression and sale history, since there's no trusted list for collections.",
  },
  {
    step: "04",
    title: "A score, and why",
    description: "0 to 100, and the specific reasons behind it. Not just a number.",
  },
];

function SampleReportCard() {
  const band = riskBand(88);
  return (
    <Card className="w-full max-w-md text-left shadow-2xl shadow-black/40">
      <CardHeader className="flex items-center justify-between gap-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">4Nd8...7hQp</span>
          <Badge className={band.badgeClass}>{band.label} risk</Badge>
        </div>
        <span className="text-xs text-muted-foreground">scanned 2s ago</span>
      </CardHeader>
      <CardContent className="flex items-start gap-4">
        <RiskGauge
          score={88}
          textClass={band.textClass}
          strokeColor={band.strokeColor}
        />
        <p className="text-sm text-muted-foreground">
          A near-zero transfer came in from an address that matches a trusted
          counterparty on both ends of the string. Copy the wrong line out of
          this history and the funds are gone.
        </p>
      </CardContent>
      <CardContent className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold tracking-wide text-muted-foreground uppercase">
            Findings
          </span>
          <span className="text-muted-foreground">4 signals</span>
        </div>
        <ul className="flex flex-col divide-y divide-border/60">
          {SAMPLE_FINDINGS.map((finding) => (
            <li
              key={finding.title}
              className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{finding.title}</p>
                <p className="text-xs text-muted-foreground">
                  {finding.message}
                </p>
              </div>
              <Badge
                className={`shrink-0 font-mono text-[10px] ${finding.tagClass}`}
              >
                {finding.tag}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="justify-center bg-transparent text-center text-xs text-muted-foreground">
        Sample report · every flag names the account behind it
      </CardFooter>
    </Card>
  );
}

function ScenarioCard({
  label,
  score,
  lines,
}: {
  label: string;
  score: number;
  lines: string[];
}) {
  const band = riskBand(score);
  return (
    <Card className="text-left">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>{label}</CardTitle>
        <Badge className={band.badgeClass}>{score}/100</Badge>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

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
        className="pointer-events-none absolute inset-x-0 -top-32 -z-10 h-[32rem] bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--primary)_28%,transparent),transparent)] blur-2xl"
      />

      <div className="flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 py-20">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Read-only · no wallet connection · nothing signed
            </div>

            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Can I trust <span className="text-primary">this wallet?</span>
            </h1>
            <p className="text-balance text-base text-muted-foreground sm:text-lg">
              Explorers are built for forensics — great if you already know
              what you&apos;re looking for, useless if that&apos;s the whole
              question. Paste any Solana address and get what&apos;s in the
              wallet, what&apos;s verified, and a score from 0 to 100 with
              the reasons behind it.
            </p>

            <form
              onSubmit={onSubmit}
              className="flex w-full max-w-xl flex-col gap-2 pt-2"
            >
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
                  Run scan
                  <ArrowRight className="size-4" />
                </Button>
              </div>
              {error && (
                <p className="text-left text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </form>

            <div className="flex flex-col gap-1 pt-2 font-mono text-xs text-muted-foreground/70">
              <p>Fifty token accounts.</p>
              <p>No idea which ones are real.</p>
              <p>No idea if that &quot;free NFT&quot; is bait.</p>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <SampleReportCard />
          </div>
        </section>

        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                Coverage
              </span>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                What it looks for
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Not a generic threat list. These are the ones that actually show
              up when you go looking, and every finding names the account it
              came from.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COVERAGE.map((item) => (
              <div
                key={item.number}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-5 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.number}
                  </span>
                  <Badge className={`text-[10px] ${SEVERITY_TAG_CLASS[item.severity]}`}>
                    {item.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 text-center">
            <span className="text-xs font-semibold tracking-wide text-primary uppercase">
              Vs. explorers
            </span>
            <p className="text-sm text-muted-foreground">
              Explorers are built for forensics, if you know what to look for.
            </p>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Wallet Sentinel is built for one question:{" "}
              <span className="text-primary">can I trust this wallet?</span>
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {SCENARIOS.map((scenario) => (
              <ScenarioCard key={scenario.label} {...scenario} />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-8 border-t border-border pt-16">
          <div className="mx-auto flex max-w-xl flex-col gap-2 text-center">
            <span className="text-xs font-semibold tracking-wide text-primary uppercase">
              How it works
            </span>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Paste, scan, done
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex flex-col gap-2 text-left">
                <span className="font-mono text-xs text-primary">
                  {item.step}
                </span>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
