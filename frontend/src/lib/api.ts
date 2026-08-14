import type {
  RisksResponse,
  TokensResponse,
  WalletSummary,
} from "@/lib/types";

function networkErrorMessage(err: unknown): string {
  if (err instanceof TypeError) {
    return "Cannot reach the API";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Failed to load wallet";
}

async function fetchJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { cache: "no-store" });
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }

  if (!response.ok) {
    let detail = "request failed";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        detail = body.error;
      }
    } catch {
      // keep generic detail
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export function getWalletSummary(address: string): Promise<WalletSummary> {
  return fetchJson<WalletSummary>(
    `/api/wallet/${encodeURIComponent(address)}/summary`,
  );
}

export function getWalletTokens(address: string): Promise<TokensResponse> {
  return fetchJson<TokensResponse>(
    `/api/wallet/${encodeURIComponent(address)}/tokens`,
  );
}

export function getWalletRisks(address: string): Promise<RisksResponse> {
  return fetchJson<RisksResponse>(
    `/api/wallet/${encodeURIComponent(address)}/risks`,
  );
}
