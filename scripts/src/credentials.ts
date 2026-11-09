import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface RootKey {
  accountId: string;
  publicKey: string;
  /** Never printed or written anywhere by this script. */
  secretKey: string;
}

/**
 * Parses a legacy keychain file as written by near-cli (`~/.near-credentials/testnet/<account>.json`):
 * `{ public_key, private_key, ... }`. The account id is the file name; an `account_id` field is
 * checked only when present.
 */
export function parseCredentialFile(text: string, expectedAccount: string): RootKey {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Credential file is not valid JSON");
  }
  const o = raw as Record<string, unknown> | null;
  const publicKey = o?.public_key;
  const secretKey = o?.private_key;
  if (typeof publicKey !== "string" || typeof secretKey !== "string") {
    throw new Error("Credential file needs public_key and private_key");
  }
  // near-cli-rs files have no account_id; the JS CLI format does.
  if (o?.account_id !== undefined && o.account_id !== expectedAccount) {
    throw new Error(`Credential file is for another account, expected ${expectedAccount}`);
  }
  if (!publicKey.startsWith("ed25519:") || !secretKey.startsWith("ed25519:")) {
    throw new Error("Only ed25519 keys are supported");
  }
  return { accountId: expectedAccount, publicKey, secretKey };
}

/**
 * Directories that may hold `<account>.json`, most specific first. On Windows the key usually lives in
 * a WSL home directory, which is readable through `\\wsl.localhost\<distro>\home\<user>`.
 */
export function credentialDirs(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const dirs: string[] = [];
  if (env.NEAR_CREDENTIALS_DIR) dirs.push(env.NEAR_CREDENTIALS_DIR);
  dirs.push(join(homedir(), ".near-credentials", "testnet"));
  if (platform === "win32") {
    const distros = [env.WSL_DISTRO, "Ubuntu-Ext", "Ubuntu"].filter((d): d is string => Boolean(d));
    for (const distro of distros) {
      const home = `\\\\wsl.localhost\\${distro}\\home`;
      try {
        for (const user of readdirSync(home)) {
          dirs.push(join(home, user, ".near-credentials", "testnet"));
        }
      } catch {
        // distro not installed or not running
      }
    }
  }
  return dirs;
}

export function loadRootKey(account: string, env: NodeJS.ProcessEnv = process.env): RootKey {
  const tried: string[] = [];
  for (const dir of credentialDirs(env, process.platform)) {
    const file = join(dir, `${account}.json`);
    tried.push(file);
    if (existsSync(file)) return parseCredentialFile(readFileSync(file, "utf8"), account);
  }
  throw new Error(
    `No key file for ${account}. Looked in:\n  ${tried.join("\n  ")}\n` +
      "Set NEAR_CREDENTIALS_DIR to the folder that holds the .json file.",
  );
}
