import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Fetches one of our own /api routes and validates the answer. Throws ApiError with the status. */
export async function getJson<S extends z.ZodTypeAny>(url: string, schema: S): Promise<z.infer<S>> {
  const res = await fetch(url, { cache: "no-store" });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(err?.message ?? `Request failed with ${res.status}`, res.status, err?.code ?? null);
  }
  return schema.parse(body);
}
