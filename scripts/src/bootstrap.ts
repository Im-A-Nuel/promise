import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider } from "near-api-js";
import { loadActors, type Actor } from "./actors.js";
import { formatNear, formatTusdc, loadConfig, type Config } from "./config.js";
import { Story } from "./story.js";

export interface Context {
  cfg: Config;
  story: Story;
  actors: Record<string, Actor>;
  repoRoot: string;
}

export function fail(message: string): never {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
}

const MIN_NEAR = 100_000_000_000_000_000_000_000n; // 0.1 NEAR for gas and storage

/**
 * Loads config and personas, checks that this really is testnet and that the contracts answer.
 * Nothing here sends a transaction.
 */
export async function bootstrap(argv: string[]): Promise<Context> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const cfg = loadConfig(argv, process.env, repoRoot);
  const provider = new JsonRpcProvider({ url: cfg.rpcUrl });
  if ((await provider.getNetworkId()) !== "testnet") fail("The RPC does not report testnet.");

  const actors = loadActors(join(repoRoot, "frontend", "src", "lib", "demo", "personas.public.json"), provider);
  for (const id of ["ayu", "budi", "citra", "dewi", "eko"]) if (!actors[id]) fail(`Persona ${id} is missing.`);
  for (const a of Object.values(actors)) {
    if (!a.accountId.endsWith(`.${cfg.root}`)) {
      fail(`Persona ${a.id} is ${a.accountId}, which is not under ${cfg.root}. Run pnpm deploy:testnet -- --execute.`);
    }
  }

  const story = new Story(provider, cfg.amplop, cfg.tusdc);
  try {
    await story.hajatCount();
  } catch {
    fail(`${cfg.amplop} does not answer. Deploy first: pnpm deploy:testnet -- --execute.`);
  }
  return { cfg, story, actors, repoRoot };
}

/** Every persona needs a little NEAR, and some need tUSDC. Returns what is missing. */
export async function preflight(ctx: Context, needTusdc: Record<string, bigint>): Promise<string[]> {
  const problems: string[] = [];
  for (const a of Object.values(ctx.actors)) {
    const near = await ctx.story.nearBalance(a.accountId);
    if (near < MIN_NEAR) problems.push(`${a.name} has ${formatNear(near)} NEAR, needs 0.1. pnpm deploy:testnet tops personas up.`);
  }
  for (const [id, need] of Object.entries(needTusdc)) {
    const a = ctx.actors[id];
    if (!a) continue;
    const have = await ctx.story.tusdcBalance(a.accountId);
    if (have < need) problems.push(`${a.name} has ${formatTusdc(have)} tUSDC, needs ${formatTusdc(need)}. pnpm deploy:testnet mints more.`);
  }
  return problems;
}
