import { z } from "zod";
import { fromError, ok, problem } from "@/lib/api";
import { getHajat, getInvitations, getNftToken } from "@/lib/near/contract";

const id = z.coerce.number().int().positive();

// GET /api/events/:id  ->  { hajat, invitations: [... + media] }. `media` is the card the contract drew.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = id.safeParse((await ctx.params).id);
  if (!parsed.success) return problem("BAD_REQUEST", "id must be a positive integer", 400);
  try {
    const hajat = await getHajat(parsed.data);
    if (!hajat) return problem("NOT_FOUND", "This event does not exist", 404);
    const invitations = await getInvitations(parsed.data, { from: 0, limit: 50 });
    const withCards = await Promise.all(
      invitations.map(async (inv) => ({
        ...inv,
        media: (await getNftToken(inv.token_id).catch(() => null))?.metadata.media ?? null,
      })),
    );
    return ok({ hajat, invitations: withCards });
  } catch (error) {
    return fromError(error);
  }
}
