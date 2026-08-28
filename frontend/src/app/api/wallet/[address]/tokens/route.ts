import { proxyWalletGet } from "@/lib/server/wallet-proxy";

export const maxDuration = 60;

export function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  return proxyWalletGet(request, context, "tokens");
}
