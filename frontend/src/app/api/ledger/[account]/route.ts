import { z } from "zod";
import { fromError, ok, problem } from "@/lib/api";
import { getLedger } from "@/lib/near/contract";

const account = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/);

// GET /api/ledger/:account  ->  { owed_to_me, i_owe }
export async function GET(_req: Request, ctx: { params: Promise<{ account: string }> }) {
  const parsed = account.safeParse((await ctx.params).account);
  if (!parsed.success) return problem("BAD_REQUEST", "account must be a NEAR account id", 400);
  try {
    return ok(await getLedger(parsed.data));
  } catch (error) {
    return fromError(error);
  }
}
