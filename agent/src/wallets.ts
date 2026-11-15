import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { requireEnv } from "./config";

// Demo wallets are test-only keys generated locally and gitignored (agent/.wallets.json).
const WALLETS_FILE = new URL("../.wallets.json", import.meta.url);

export const ROLES = [
  "agent", // the detection agent (posts verdicts) — separate from the funder so their nonces never collide
  "victim",
  "clean", // baseline depositor
  "ransom",
  "hop1",
  "hop2",
  "hop3",
  "hop4",
  "merge",
  "cashout",
] as const;
export type Role = (typeof ROLES)[number];

export type Wallets = Record<Role, PrivateKeyAccount> & { funder: PrivateKeyAccount };

export async function loadWallets(opts: { create?: boolean; fresh?: boolean } = {}): Promise<Wallets> {
  const file = Bun.file(WALLETS_FILE);
  let keys: Partial<Record<Role, `0x${string}`>> = {};
  if (!opts.fresh && (await file.exists())) keys = await file.json();

  const missing = ROLES.filter((r) => !keys[r]);
  if (missing.length) {
    if (!opts.create) throw new Error(`No demo wallets for ${missing.join(", ")}. Run: bun run setup`);
    for (const r of missing) keys[r] = generatePrivateKey();
    await Bun.write(file, JSON.stringify(keys, null, 2) + "\n");
  }

  const funderKey = requireEnv("WALLET2_PRIVATE_KEY") as `0x${string}`;
  const out = { funder: privateKeyToAccount(funderKey) } as Wallets;
  for (const r of ROLES) out[r] = privateKeyToAccount(keys[r]!);
  return out;
}
