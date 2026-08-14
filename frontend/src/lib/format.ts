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

export function riskBand(score: number): {
  label: string;
  className: string;
} {
  if (score === 0) {
    return { label: "Low", className: "text-foreground" };
  }
  if (score < 40) {
    return { label: "Elevated", className: "text-foreground" };
  }
  if (score < 70) {
    return { label: "High", className: "text-yellow-800" };
  }
  return { label: "Critical", className: "text-red-800" };
}
