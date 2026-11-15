// Detection agent: watch dUSD transfers on Monad, match behaviors, post verdicts onchain, write reports.
//   bun run agent            follow the chain (Ctrl-C to stop)
//   bun run agent --once     one pass, then exit
import { createPublicClient, createWalletClient, http, keccak256, parseEventLogs, toBytes, type Hash, type Log } from "viem";
import { readdir } from "node:fs/promises";
import { ABI, ADDRESSES, DEPLOY_BLOCK, EXPLORER, LOG_CHUNK, monadTestnet } from "./config";
import { analyze, B, short, type Transfer, type WalletResult } from "./engine";
import { buildReport, isFlagged, VERDICT_NAME, writeReport } from "./report";
import { loadWallets } from "./wallets";

const POLL_MS = 400; // ~one Monad block
const once = process.argv.includes("--once");

const w = await loadWallets();
const pub = createPublicClient({ chain: monadTestnet, transport: http() });
const agent = createWalletClient({ account: w.agent, chain: monadTestnet, transport: http() });

// Known services: never judged, and money from them counts as a clean origin.
const allowlist = [w.funder.address, ADDRESSES.exchange, ADDRESSES.token];

const t0 = () => new Date().toISOString().slice(11, 23);
const log = (m: string) => console.log(`[${t0()}] ${m}`);

/** Offchain evidence: every 0x address in agent/evidence/*.txt is tied to that file's keccak256. */
async function loadEvidence(): Promise<Map<string, `0x${string}`>> {
  const dir = new URL("../evidence/", import.meta.url);
  const out = new Map<string, `0x${string}`>();
  let files: string[] = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".txt"));
  } catch {
    return out;
  }
  for (const f of files) {
    const text = await Bun.file(new URL(f, dir)).text();
    const hash = keccak256(toBytes(text));
    for (const a of text.match(/0x[0-9a-fA-F]{40}/g) ?? []) out.set(a.toLowerCase(), hash);
  }
  return out;
}

/**
 * Monad's public RPC is load-balanced: a block that one node just served can be "not found" on the next.
 * Retry reads briefly instead of treating lag as failure.
 */
async function retry<T>(fn: () => Promise<T>, tries = 8, waitMs = 250): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries - 1) throw e;
      await Bun.sleep(waitMs);
    }
  }
}

const blockTime = new Map<bigint, number>();
async function timestampOf(n: bigint) {
  if (!blockTime.has(n)) blockTime.set(n, Number((await retry(() => pub.getBlock({ blockNumber: n }))).timestamp));
  return blockTime.get(n)!;
}

const transfers: Transfer[] = [];
const seen = new Set<string>(); // txHash:logIndex — a chunk re-read after a lagging-node error must not double-count
let nextBlock = DEPLOY_BLOCK;

async function pull(): Promise<number> {
  const head = await pub.getBlockNumber();
  let added = 0;
  while (nextBlock <= head) {
    const to = nextBlock + LOG_CHUNK - 1n > head ? head : nextBlock + LOG_CHUNK - 1n;
    const from = nextBlock;
    const logs = await retry(() => pub.getLogs({ address: ADDRESSES.token, fromBlock: from, toBlock: to }));
    const parsed = parseEventLogs({ abi: ABI.token, logs: logs as Log[], eventName: "Transfer" }) as unknown as {
      args: { from: `0x${string}`; to: `0x${string}`; value: bigint };
      blockNumber: bigint;
      transactionHash: Hash;
      logIndex: number;
    }[];
    for (const l of parsed) {
      const key = `${l.transactionHash}:${l.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      transfers.push({
        from: l.args.from,
        to: l.args.to,
        value: l.args.value,
        block: l.blockNumber,
        timestamp: await timestampOf(l.blockNumber),
        txHash: l.transactionHash,
        logIndex: l.logIndex,
      });
      added++;
    }
    nextBlock = to + 1n;
  }
  return added;
}

/** What the registry already says, so we only post changes. */
const posted = new Map<string, { verdict: number; behaviors: number }>();
async function onchain(wallet: string) {
  if (!posted.has(wallet)) {
    const rec = (await pub.readContract({ address: ADDRESSES.registry, abi: ABI.registry, functionName: "getRecord", args: [wallet] })) as {
      verdict: number;
      behaviors: number;
    };
    posted.set(wallet, { verdict: Number(rec.verdict), behaviors: Number(rec.behaviors) });
  }
  return posted.get(wallet)!;
}

const bitNames = (bits: number) =>
  Object.entries(B)
    .filter(([, b]) => bits & b)
    .map(([n]) => n)
    .join(" + ");

async function tick() {
  const added = await pull();
  if (!added && posted.size) return;

  const results = analyze({ transfers, allowlist, evidence: await loadEvidence() });
  const changed: WalletResult[] = [];
  for (const r of results.values()) {
    if (!isFlagged(r)) continue;
    const cur = await onchain(r.wallet.toLowerCase());
    if (cur.verdict !== r.verdict || cur.behaviors !== r.behaviors) changed.push(r);
  }
  if (!changed.length) return;

  const reports = changed.map((r) => ({ r, ...buildReport(r, transfers) }));
  for (const { r } of reports) log(`${VERDICT_NAME[r.verdict].padEnd(10)} ${short(r.wallet)}  ${bitNames(r.behaviors)}`);

  const zero = `0x${"0".repeat(64)}` as const;
  const h = await agent.writeContract({
    address: ADDRESSES.registry,
    abi: ABI.registry,
    functionName: "setVerdicts",
    args: [
      reports.map((x) => x.r.wallet),
      reports.map((x) => x.r.verdict),
      reports.map((x) => x.r.behaviors),
      reports.map((x) => x.hash),
      reports.map((x) => x.r.evidenceHash ?? zero),
    ],
  });
  // The tx is sent: record it now, so a lagging-node error below can never trigger a duplicate send.
  const previous = reports.map((x) => [x.r.wallet.toLowerCase(), posted.get(x.r.wallet.toLowerCase())] as const);
  for (const x of reports) posted.set(x.r.wallet.toLowerCase(), { verdict: x.r.verdict, behaviors: x.r.behaviors });

  const rcpt = await retry(() => pub.waitForTransactionReceipt({ hash: h }));
  if (rcpt.status !== "success") {
    for (const [wallet, prev] of previous) prev ? posted.set(wallet, prev) : posted.delete(wallet);
    throw new Error(`setVerdicts reverted: ${EXPLORER}/tx/${h}`);
  }
  log(`posted ${reports.length} verdict(s) onchain in one tx  ${EXPLORER}/tx/${h}`);

  for (const x of reports) await writeReport(x.report, x.hash, h);
  log(`reports written to agent/reports/`);

  // Latency is informational: never let a lagging node fail the tick over it.
  try {
    const newest = transfers.reduce((m, t) => (t.timestamp > m ? t.timestamp : m), 0);
    const landed = await timestampOf(rcpt.blockNumber);
    log(`verdict landed ${landed - newest}s (chain time) after the latest transfer it covers`);
  } catch {
    log(`verdict landed (latency unavailable: RPC lag)`);
  }
}

log(`agent ${w.agent.address} watching dUSD ${ADDRESSES.token} from block ${DEPLOY_BLOCK}`);
await tick();
if (!once) {
  for (;;) {
    await Bun.sleep(POLL_MS);
    try {
      await tick();
    } catch (e) {
      log(`error: ${(e as Error).message.split("\n")[0]}`);
    }
  }
}
