import { z } from "zod";

const schema = z.object({
  network: z.literal("testnet"),
  rpcUrl: z.string().url(),
  rpcFallbackUrl: z.string().url(),
  amplopId: z.string().min(2),
  ftId: z.string().min(2),
  explorerUrl: z.string().url(),
  appUrl: z.string().url(),
  defaultLocale: z.enum(["en", "id"]),
});

// NEXT_PUBLIC_* must be read as literal property accesses so Next can inline them in the browser.
export const env = schema.parse({
  network: process.env.NEXT_PUBLIC_NETWORK ?? "testnet",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "https://test.rpc.fastnear.com",
  rpcFallbackUrl: process.env.NEXT_PUBLIC_RPC_FALLBACK_URL ?? "https://rpc.testnet.near.org",
  amplopId: process.env.NEXT_PUBLIC_AMPLOP_ID ?? "amplop.promisedemo.testnet",
  ftId: process.env.NEXT_PUBLIC_FT_ID ?? "tusdc.promisedemo.testnet",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://testnet.nearblocks.io",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en",
});
