import { z } from "zod";
import { fromError, problem } from "@/lib/api";
import { getNftToken } from "@/lib/near/contract";

const id = z.coerce.number().int().positive();
const PREFIX = "data:image/svg+xml;base64,";

// GET /api/nft/:id/image.svg  (docs/SCHEMA.md)
// The card exactly as the contract drew it, decoded from the `media` data URI. We do not generate or edit it.
// Text a guest or host typed is escaped by the contract (svg.rs `escape`), and the site-wide headers (nosniff, no
// framing) apply here as everywhere.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const parsed = id.safeParse((await ctx.params).id);
  if (!parsed.success) return problem("BAD_REQUEST", "id must be a positive integer", 400);

  try {
    const token = await getNftToken(parsed.data);
    const media = token?.metadata.media;
    if (!media) return problem("NOT_FOUND", "This invitation has no card", 404);
    if (!media.startsWith(PREFIX)) return problem("INTERNAL", "The card is not an svg we can serve", 500);

    return new Response(Buffer.from(media.slice(PREFIX.length), "base64"), {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=15",
      },
    });
  } catch (error) {
    return fromError(error);
  }
}
