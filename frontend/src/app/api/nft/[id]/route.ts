import { z } from "zod";
import { fromError, ok, problem } from "@/lib/api";
import { getHajat, getNftToken } from "@/lib/near/contract";

const id = z.coerce.number().int().positive();
const extraSchema = z.object({ hajat_id: z.number().int().positive().optional(), status: z.string().optional() }).passthrough();

// GET /api/nft/:id  (docs/SCHEMA.md)
//   -> { title, description, media, attributes: [{ trait_type, value }] }
// This is the document the NEP-177 `reference` field of every invitation points to. `media` is the url of the card
// the contract drew (see ./image.svg). Nothing here is stored by us: it is read from the contract on each request.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = id.safeParse((await ctx.params).id);
  if (!parsed.success) return problem("BAD_REQUEST", "id must be a positive integer", 400);

  try {
    const token = await getNftToken(parsed.data);
    if (!token) return problem("NOT_FOUND", "This invitation does not exist", 404);

    let extra: z.infer<typeof extraSchema> = {};
    try {
      extra = extraSchema.parse(JSON.parse(token.metadata.extra ?? "{}"));
    } catch {
      // `extra` is informational. A shape we do not know just means fewer attributes.
    }
    const hajat = extra.hajat_id ? await getHajat(extra.hajat_id).catch(() => null) : null;

    const attributes: { trait_type: string; value: string }[] = [];
    if (extra.status) attributes.push({ trait_type: "status", value: extra.status });
    if (hajat) attributes.push({ trait_type: "hajat", value: hajat.title });

    return ok({
      title: token.metadata.title,
      description: token.metadata.description,
      media: `${new URL(req.url).origin}/api/nft/${parsed.data}/image.svg`,
      attributes,
    });
  } catch (error) {
    return fromError(error);
  }
}
