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

/** Fetches one of our own /api routes and validates the answer. Always throws ApiError, never a raw fetch or zod error. */
export async function getJson<S extends z.ZodTypeAny>(url: string, schema: S): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
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
