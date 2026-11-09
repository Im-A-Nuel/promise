import { z } from "zod";
import { fromError, ok, problem } from "@/lib/api";
import { getHajat, getInvitations, getNftToken, suggestReply } from "@/lib/near/contract";

const id = z.coerce.number().int().positive();
const account = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/);

// GET /api/events/:id?viewer=ACCOUNT
//   -> { hajat, invitations: [... + media], suggested_reply }
// `media` is the card the contract drew. `suggested_reply` is what the viewer still owes this event's host.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = id.safeParse((await ctx.params).id);
  if (!parsed.success) return problem("BAD_REQUEST", "id must be a positive integer", 400);

  const viewerParam = new URL(req.url).searchParams.get("viewer");
  const viewer = viewerParam === null ? null : account.safeParse(viewerParam);
  if (viewer && !viewer.success) return problem("BAD_REQUEST", "viewer must be a NEAR account id", 400);

  try {
    const hajat = await getHajat(parsed.data);
    if (!hajat) return problem("NOT_FOUND", "This event does not exist", 404);
    const [invitations, suggested] = await Promise.all([
      getInvitations(parsed.data, { from: 0, limit: 50 }),
      viewer?.success ? suggestReply(parsed.data, viewer.data) : Promise.resolve(null),
    ]);
    const withCards = await Promise.all(
      invitations.map(async (inv) => ({
        ...inv,
        media: (await getNftToken(inv.token_id).catch(() => null))?.metadata.media ?? null,
      })),
    );
    return ok({ hajat, invitations: withCards, suggested_reply: suggested });
  } catch (error) {
    return fromError(error);
  }
}
