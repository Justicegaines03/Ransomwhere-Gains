import { defineChain, http, type Address } from "viem";
import VerdictRegistryAbi from "./abi/VerdictRegistry.json";
import DemoExchangeAbi from "./abi/DemoExchange.json";
import DemoTokenAbi from "./abi/DemoToken.json";

// Bun auto-loads .env from the cwd; the repo keeps one at the root.
const rootEnv = Bun.file(new URL("../../.env", import.meta.url));
if (await rootEnv.exists()) {
  for (const line of (await rootEnv.text()).split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export const RPC_URL = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const EXPLORER = "https://testnet.monadexplorer.com";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Monad Explorer", url: EXPLORER } },
  testnet: true,
});

// Deployed 2026-11-15 (see contracts/broadcast/Deploy.s.sol/10143/run-latest.json)
export const ADDRESSES = {
  token: "0x4c5a52AB5bb8589fE576c940fD23F07Bb1D97B5D",
  registry: "0x3525Bd36afB988f8cFeBB95e2C15Af1ee202F8c9",
  exchange: "0xbd1e7D8Cd4b8D70D9B1A545a44cf5bE26958BfE1", // redeployed with rollback(); first version: 0xD307DE57992B1b01cd95Ce7E38b15251D881950A
} as const satisfies Record<string, Address>;

export const DEPLOY_BLOCK = 80026796n;

/**
 * The public Monad RPC rate-limits (HTTP 429) under load. Every client retries with backoff;
 * `batch` packs concurrent reads into one HTTP request (used by the UI's state poller).
 */
export const rpc = (opts: { batch?: boolean } = {}) =>
  http(RPC_URL, { retryCount: 8, retryDelay: 400, batch: opts.batch ? { batchSize: 50, wait: 20 } : false });

/** Monad testnet rejects eth_getLogs ranges much over 100 blocks. */
export const LOG_CHUNK = 100n;

export const ABI = {
  registry: VerdictRegistryAbi,
  exchange: DemoExchangeAbi,
  token: DemoTokenAbi,
} as const;

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}
