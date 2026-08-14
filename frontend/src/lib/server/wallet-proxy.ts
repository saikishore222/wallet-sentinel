import { isValidSolanaAddress } from "@/lib/solana";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const AXUM_TIMEOUT_MS = 15_000;

const hits = new Map<string, number[]>();

type RouteContext = {
  params: Promise<{ address: string }>;
};

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const stamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_REQUESTS) {
    hits.set(ip, stamps);
    return false;
  }
  stamps.push(now);
  hits.set(ip, stamps);
  return true;
}

function mapUpstreamStatus(status: number): { status: number; error: string } {
  if (status === 400) {
    return { status: 400, error: "invalid request" };
  }
  if (status === 401) {
    return { status: 401, error: "unauthorized" };
  }
  if (status === 429) {
    return { status: 429, error: "rate limited" };
  }
  if (status === 502 || status === 503 || status === 504) {
    return { status: 502, error: "upstream unavailable" };
  }
  return { status: 502, error: "upstream unavailable" };
}

async function proxyToAxum(
  address: string,
  resource: "summary" | "tokens" | "risks",
): Promise<Response> {
  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");
  const apiKey = process.env.API_KEY;

  if (!backendUrl || !apiKey) {
    console.error("BACKEND_URL and API_KEY must be set");
    return jsonError(500, "server misconfigured");
  }

  const url = `${backendUrl}/wallet/${encodeURIComponent(address)}/${resource}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(AXUM_TIMEOUT_MS),
    });
  } catch {
    return jsonError(502, "upstream unavailable");
  }

  if (!response.ok) {
    const mapped = mapUpstreamStatus(response.status);
    return jsonError(mapped.status, mapped.error);
  }

  const body: unknown = await response.json();
  return Response.json(body);
}

export async function proxyWalletGet(
  request: Request,
  context: RouteContext,
  resource: "summary" | "tokens" | "risks",
): Promise<Response> {
  if (!allowRequest(clientIp(request))) {
    return jsonError(429, "rate limited");
  }

  const { address } = await context.params;
  if (!isValidSolanaAddress(address)) {
    return jsonError(400, "invalid Solana wallet address");
  }

  return proxyToAxum(address, resource);
}
