import { z } from "zod";
import { fromError, ok, problem } from "@/lib/api";
import { getTusdcBalance, isTusdcRegistered } from "@/lib/near/contract";

const account = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/);

// GET /api/balance/:account  ->  { tusdc, registered }. Public chain data, cached like the other reads.
export async function GET(_req: Request, ctx: { params: Promise<{ account: string }> }) {
  const parsed = account.safeParse((await ctx.params).account);
  if (!parsed.success) return problem("BAD_REQUEST", "account must be a NEAR account id", 400);
  try {
    const [tusdc, registered] = await Promise.all([getTusdcBalance(parsed.data), isTusdcRegistered(parsed.data)]);
    return ok({ tusdc, registered });
  } catch (error) {
    return fromError(error);
  }
}
