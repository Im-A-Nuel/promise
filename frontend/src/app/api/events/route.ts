import { fromError, ok } from "@/lib/api";
import { getHajats } from "@/lib/near/contract";

// GET /api/events  ->  { events: Hajat[] }, newest first. The contract calls an event a hajat.
export async function GET() {
  try {
    return ok({ events: await getHajats({ from: 0, limit: 20 }) });
  } catch (error) {
    return fromError(error);
  }
}
