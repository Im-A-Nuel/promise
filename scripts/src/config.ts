import { parseArgs } from "node:util";
import { join } from "node:path";

export const PERSONA_IDS = ["ayu", "budi", "citra", "dewi", "eko"] as const;

const YOCTO = 10n ** 24n;
const TUSDC_UNIT = 10n ** 6n;

/** "4" -> 4 NEAR in yocto, "0.5" -> 0.5 NEAR. Rejects anything else. */
export function parseNear(text: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,24}))?$/.exec(text.trim());
  if (!m) throw new Error(`Not a NEAR amount: "${text}"`);
  const frac = (m[2] ?? "").padEnd(24, "0");
  return BigInt(m[1] ?? "0") * YOCTO + BigInt(frac || "0");
}

export function formatNear(yocto: bigint): string {
  const whole = yocto / YOCTO;
  const frac = (yocto % YOCTO).toString().padStart(24, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function formatTusdc(units: bigint): string {
  const whole = units / TUSDC_UNIT;
  const frac = (units % TUSDC_UNIT).toString().padStart(6, "0").replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${frac}`;
}

export interface Config {
  root: string;
  tusdc: string;
  amplop: string;
  personas: { id: string; account: string }[];
  execute: boolean;
  /** seed and demo: print the plan and send nothing */
  dryRun: boolean;
  /** seed and demo: how many hours ahead the events are */
  hours: number;
  rpcUrl: string;
  appUrl: string;
  tusdcWasm: string;
  amplopWasm: string;
  /** NEAR sent to each new account, in yocto */
  fund: { tusdc: bigint; amplop: bigint; persona: bigint };
  /** tUSDC each persona should hold, in base units */
  personaTusdc: bigint;
  repoRoot: string;
}

const ACCOUNT_RE = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/;

export function loadConfig(argv: string[], env: NodeJS.ProcessEnv, repoRoot: string): Config {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" },
      execute: { type: "boolean", default: false },
      "app-url": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      hours: { type: "string" },
    },
    allowPositionals: false,
  });

  const root = values.root ?? env.ROOT_ACCOUNT ?? "promisedemo.testnet";
  if (!ACCOUNT_RE.test(root) || !root.endsWith(".testnet")) {
    throw new Error(`Root account must be a *.testnet account, got "${root}". Mainnet is never used here.`);
  }

  const rpcUrl = env.RPC_URL ?? "https://test.rpc.fastnear.com";
  if (/mainnet/i.test(rpcUrl)) throw new Error(`Refusing to use an RPC url that looks like mainnet: ${rpcUrl}`);

  const hours = Number(values.hours ?? env.EVENT_HOURS ?? "12");
  if (!Number.isFinite(hours) || hours < 1 || hours > 300) throw new Error("--hours must be between 1 and 300");

  const wasm = (name: string) => join(repoRoot, "contract", "target", "near", name, `${name}.wasm`);

  return {
    root,
    tusdc: `tusdc.${root}`,
    amplop: `amplop.${root}`,
    personas: PERSONA_IDS.map((id) => ({ id, account: `${id}.${root}` })),
    execute: values.execute === true,
    dryRun: values["dry-run"] === true,
    hours,
    rpcUrl,
    appUrl: values["app-url"] ?? env.APP_URL ?? "http://localhost:3000",
    tusdcWasm: env.TUSDC_WASM ?? wasm("tusdc"),
    amplopWasm: env.AMPLOP_WASM ?? wasm("amplop"),
    fund: {
      tusdc: parseNear(env.FUND_TUSDC ?? "4"),
      amplop: parseNear(env.FUND_AMPLOP ?? "8"),
      persona: parseNear(env.FUND_PERSONA ?? "1"),
    },
    personaTusdc: 500n * TUSDC_UNIT,
    repoRoot,
  };
}
