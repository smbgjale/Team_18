import { config } from "./config";

export class CloudflareError extends Error {
  constructor(
    public status: number,
    message: string,
    public quotaExceeded: boolean,
  ) {
    super(message);
  }
}

// Calls POST /accounts/{id}/ai/run/{model} and returns the `result` field of the response envelope.
export async function runWorkersAI(model: string, body: BodyInit, contentType?: string, timeoutMs = 120_000): Promise<unknown> {
  const { accountId, apiToken } = config.cloudflare;
  if (!accountId || !apiToken) throw new CloudflareError(0, "CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set", false);
  const headers: Record<string, string> = { Authorization: `Bearer ${apiToken}` };
  if (contentType) headers["Content-Type"] = contentType;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: { success?: boolean; result?: unknown; errors?: { code?: number; message?: string }[] } = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || json.success === false) {
    const message = json.errors?.map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim()).join("; ") || text.slice(0, 300);
    const quota = res.status === 429 || /neuron|quota|limit exceeded|daily/i.test(message);
    throw new CloudflareError(res.status, `Workers AI returned ${res.status}: ${message}`, quota);
  }
  return json.result;
}
