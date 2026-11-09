import type { Config } from "./config.js";

export interface PersonaFile {
  _note?: string;
  personas: {
    id: string;
    name: string;
    account_id: string;
    role: { en: string; id: string };
    blurb: { en: string; id: string };
    secret_key: string | null;
  }[];
}

/** Sets account ids from the root account and fills in secret keys. Keeps everything else. */
export function updatePersonaFile(
  file: PersonaFile,
  cfg: Pick<Config, "personas">,
  keys: Record<string, string>,
): PersonaFile {
  return {
    ...file,
    personas: file.personas.map((p) => {
      const target = cfg.personas.find((c) => c.id === p.id);
      return {
        ...p,
        account_id: target?.account ?? p.account_id,
        secret_key: keys[p.id] ?? p.secret_key,
      };
    }),
  };
}

/** Public web settings only. Contains no secret. */
export function envLocal(cfg: Pick<Config, "amplop" | "tusdc" | "rpcUrl" | "appUrl">): string {
  return [
    "NEXT_PUBLIC_NETWORK=testnet",
    `NEXT_PUBLIC_RPC_URL=${cfg.rpcUrl}`,
    "NEXT_PUBLIC_RPC_FALLBACK_URL=https://rpc.testnet.near.org",
    `NEXT_PUBLIC_AMPLOP_ID=${cfg.amplop}`,
    `NEXT_PUBLIC_FT_ID=${cfg.tusdc}`,
    "NEXT_PUBLIC_EXPLORER_URL=https://testnet.nearblocks.io",
    `NEXT_PUBLIC_APP_URL=${cfg.appUrl}`,
    "NEXT_PUBLIC_DEFAULT_LOCALE=en",
    "",
  ].join("\n");
}
