import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when no answer came back at all (offline, timed out) */
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const TIMEOUT_MS = 15_000;
/** How long after a transaction reads skip the CDN. The CDN keeps an answer for up to 30 seconds, longer than any wait. */
const FRESH_MS = 45_000;

let freshUntil = 0;

/**
 * Call this when a transaction has finished. The /api routes are cached at the edge for 10 seconds and may be served
 * stale for 20 more, so without this the screen keeps showing the state from before the transaction. For a while
 * afterwards every read asks for a URL the edge has not seen, which makes it go to the chain.
 */
export function markChainChanged(now: number = Date.now()): void {
  freshUntil = now + FRESH_MS;
}

/** The url as it should be requested right now: untouched normally, with a per second marker while reads must be fresh. */
export function readUrl(url: string, now: number = Date.now()): string {
  if (now >= freshUntil) return url;
  return `${url}${url.includes("?") ? "&" : "?"}fresh=${Math.floor(now / 1000)}`;
}

/** Fetches one of our own /api routes and validates the answer. Always throws ApiError, never a raw fetch or zod error. */
export async function getJson<S extends z.ZodTypeAny>(url: string, schema: S): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(readUrl(url), { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ApiError("No answer from the server", 0, "NETWORK");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(err?.message ?? `Request failed with ${res.status}`, res.status, err?.code ?? null);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError("The server answered in a shape we do not know", res.status, "BAD_SHAPE");
  return parsed.data;
}
