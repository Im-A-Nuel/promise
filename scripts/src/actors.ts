import { readFileSync } from "node:fs";
import { Account, KeyPairSigner, type JsonRpcProvider, type KeyPairString } from "near-api-js";

/** A demo persona that can sign. Their keys are public on purpose (testnet accounts, test tokens only). */
export class Actor {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly accountId: string,
    readonly account: Account,
  ) {}
}

interface PersonaRecord {
  id: string;
  name: string;
  account_id: string;
  secret_key: string | null;
}

export function loadActors(personaPath: string, provider: JsonRpcProvider): Record<string, Actor> {
  const file = JSON.parse(readFileSync(personaPath, "utf8")) as { personas: PersonaRecord[] };
  const out: Record<string, Actor> = {};
  for (const p of file.personas) {
    if (!p.secret_key) {
      throw new Error(`Persona ${p.id} has no key yet. Run pnpm deploy:testnet -- --execute first.`);
    }
    const signer = KeyPairSigner.fromSecretKey(p.secret_key as KeyPairString);
    out[p.id] = new Actor(p.id, p.name, p.account_id, new Account(p.account_id, provider, signer));
  }
  return out;
}
