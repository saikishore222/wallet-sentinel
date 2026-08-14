import { proxyWalletGet } from "@/lib/server/wallet-proxy";

export function GET(request: Request, context: { params: Promise<{ address: string }> }) {
  return proxyWalletGet(request, context, "risks");
}
