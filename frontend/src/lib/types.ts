export interface WalletSummary {
  address: string;
  sol_balance: number;
}

export interface TokenHolding {
  mint: string;
  amount: number;
  verified: boolean;
  symbol?: string;
}

export interface TokensResponse {
  address: string;
  tokens: TokenHolding[];
}

export type RiskSeverity = "low" | "medium" | "high";

export interface RiskFlag {
  flag_type: string;
  severity: RiskSeverity;
  message: string;
}

export interface RisksResponse {
  address: string;
  risk_score: number;
  flags: RiskFlag[];
}
