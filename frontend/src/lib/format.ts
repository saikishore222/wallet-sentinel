const FLAG_TITLES: Record<string, string> = {
  known_scam: "Known scam",
  unverified_flood: "Unverified flood",
  dust_tokens: "Dust tokens",
  spam_token: "Spam token",
  unverified_majority: "Mostly unverified",
  address_poisoning: "Address poisoning",
};

export function truncateAddress(address: string, start = 4, end = 4): string {
  if (address.length <= start + end + 1) {
    return address;
  }
  return `${address.slice(0, start)}…${address.slice(-end)}`;
}

export function formatAmount(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "—";
  }
  if (Math.abs(amount) >= 1_000_000) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (Math.abs(amount) >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function formatSol(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function flagTitle(flagType: string): string {
  return FLAG_TITLES[flagType] ?? flagType.replaceAll("_", " ");
}

export function formatRiskMessage(message: string): string {
  return message.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, (mint) =>
    truncateAddress(mint, 8, 8),
  );
}

export type RiskBand = {
  label: string;
  textClass: string;
  badgeClass: string;
  strokeColor: string;
};

export function riskBand(score: number): RiskBand {
  if (score === 0) {
    return {
      label: "Low",
      textClass: "text-emerald-400",
      badgeClass: "bg-emerald-400/15 text-emerald-400",
      strokeColor: "oklch(0.72 0.19 155)",
    };
  }
  if (score < 40) {
    return {
      label: "Elevated",
      textClass: "text-yellow-300",
      badgeClass: "bg-yellow-300/15 text-yellow-300",
      strokeColor: "oklch(0.83 0.18 95)",
    };
  }
  if (score < 70) {
    return {
      label: "High",
      textClass: "text-orange-400",
      badgeClass: "bg-orange-400/15 text-orange-400",
      strokeColor: "oklch(0.75 0.17 55)",
    };
  }
  return {
    label: "Critical",
    textClass: "text-red-400",
    badgeClass: "bg-red-400/15 text-red-400",
    strokeColor: "oklch(0.65 0.22 25)",
  };
}

const ERROR_COPY: Record<string, string> = {
  "upstream unavailable":
    "The data source is taking longer than usual to respond — this can happen for wallets holding a very large number of tokens.",
  "rate limited": "You're checking wallets a bit too fast. Wait a moment and try again.",
  "invalid Solana wallet address": "That doesn't look like a valid Solana address.",
  "invalid request": "That doesn't look like a valid Solana address.",
  unauthorized: "This app isn't configured correctly (missing API credentials).",
  "Cannot reach the API": "Couldn't reach the server. Check your connection and try again.",
};

export function humanizeError(message: string): string {
  return ERROR_COPY[message] ?? message;
}
