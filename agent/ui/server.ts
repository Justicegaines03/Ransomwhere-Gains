// Demo UI backend: buttons in the browser run the SAME commands as the CLI (src/stage.ts, src/agent.ts).
//   bun run ui   ->  http://127.0.0.1:4545
// Localhost only. Fixed command list (no user input reaches a process). Private keys never leave this process.
import { createPublicClient, parseEventLogs, type Log } from "viem";
import type { Subprocess } from "bun";
import { ABI, ADDRESSES, EXPLORER, monadTestnet, rpc } from "../src/config";
import { loadWallets, ROLES } from "../src/wallets";

const PORT = 4545;
const AGENT_DIR = new URL("../", import.meta.url).pathname;
const pub = createPublicClient({ chain: monadTestnet, transport: rpc({ batch: true }) });

// ---------- live event stream (Server-Sent Events) ----------
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const enc = new TextEncoder();
function broadcast(event: Record<string, unknown>) {
  const data = enc.encode(`data: ${JSON.stringify(event)}\n\n`);
  for (const c of clients) {
    try {
      c.enqueue(data);
    } catch {
      clients.delete(c);
    }
  }
}
const history: Record<string, unknown>[] = []; // recent log lines for late-joining browsers
function logLine(source: string, line: string) {
  const ev = { type: "log", source, line, at: Date.now() };
  history.push(ev);
  if (history.length > 300) history.shift();
  broadcast(ev);
}

async function pipeLines(stream: ReadableStream<Uint8Array> | null, source: string) {
  if (!stream) return;
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of stream) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trimEnd();
      buf = buf.slice(i + 1);
      if (line && !line.startsWith("$ bun run")) logLine(source, line);
    }
  }
  if (buf.trim()) logLine(source, buf.trim());
}

// ---------- processes: the agent, and one staging command at a time ----------
let agentProc: Subprocess | null = null;
let stageProc: Subprocess | null = null;
let stageName: string | null = null;

function startAgent() {
  if (agentProc) return false;
  agentProc = Bun.spawn(["bun", "run", "src/agent.ts"], { cwd: AGENT_DIR, stdout: "pipe", stderr: "pipe" });
  logLine("ui", "agent started");
  pipeLines(agentProc.stdout as ReadableStream<Uint8Array>, "agent");
  pipeLines(agentProc.stderr as ReadableStream<Uint8Array>, "agent");
  const p = agentProc;
  p.exited.then((code) => {
    if (agentProc === p) agentProc = null;
    logLine("ui", `agent stopped (exit ${code})`);
    broadcast({ type: "status" });
  });
  broadcast({ type: "status" });
  return true;
}

async function stopAgent() {
  if (!agentProc) return;
  const p = agentProc;
  p.kill();
  await p.exited;
}

const STAGES: Record<string, string[]> = {
  setup: ["bun", "run", "src/stage.ts", "setup", "--fresh"],
  clean: ["bun", "run", "src/stage.ts", "clean"],
  incident: ["bun", "run", "src/stage.ts", "incident"],
  cashout: ["bun", "run", "src/stage.ts", "cashout"],
  pay: ["bun", "run", "src/stage.ts", "pay"],
  launder: ["bun", "run", "src/stage.ts", "launder"],
};

/**
 * Fresh wallets only when the current set was already used in an incident (the rules need brand-new wallets).
 * Otherwise `setup` just tops up and finishes — so retrying a half-failed setup never throws away gas.
 */
async function needsFreshWallets(): Promise<boolean> {
  try {
    const w = await loadWallets();
    // "Used" = the ransom wallet has received or sent anything, or any verdict exists for it or the cash-out wallet.
    const [ransomNonce, ransomBal, ransomVerdict, cashVerdict] = await Promise.all([
      pub.getTransactionCount({ address: w.ransom.address }),
      pub.readContract({ address: ADDRESSES.token, abi: ABI.token, functionName: "balanceOf", args: [w.ransom.address] }) as Promise<bigint>,
      pub.readContract({ address: ADDRESSES.registry, abi: ABI.registry, functionName: "verdictOf", args: [w.ransom.address] }) as Promise<number>,
      pub.readContract({ address: ADDRESSES.registry, abi: ABI.registry, functionName: "verdictOf", args: [w.cashout.address] }) as Promise<number>,
    ]);
    return ransomNonce > 0 || ransomBal > 0n || Number(ransomVerdict) !== 0 || Number(cashVerdict) !== 0;
  } catch {
    return true; // no wallets yet
  }
}

/** A victim who pays from their own wallet (MetaMask) replaces the generated victim in the console until the next reset. */
let victimOverride: string | null = null;

async function runStage(name: string, arg?: string) {
  let cmd =
    (name === "release" || name === "rollback") && arg && /^\d+$/.test(arg) ? ["bun", "run", "src/stage.ts", name, arg]
    : name === "fund" && arg && /^0x[0-9a-fA-F]{40}$/.test(arg) ? ["bun", "run", "src/stage.ts", "fund", arg]
    : STAGES[name];
  if (name === "setup") victimOverride = null;
  if (!cmd) return { ok: false, error: "unknown step" };
  if (stageProc) return { ok: false, error: `"${stageName}" is still running` };
  if (name === "setup" && !(await needsFreshWallets())) cmd = cmd.filter((a) => a !== "--fresh");

  // A fresh setup hands the registry to a NEW agent wallet: the running agent must restart with it.
  const restartAgent = name === "setup" && agentProc !== null;
  if (name === "setup") await stopAgent();

  stageName = name;
  stageProc = Bun.spawn(cmd, { cwd: AGENT_DIR, stdout: "pipe", stderr: "pipe" });
  logLine("ui", `▶ ${cmd.slice(2).join(" ")}`);
  broadcast({ type: "status" });
  const out = pipeLines(stageProc.stdout as ReadableStream<Uint8Array>, "stage");
  const err = pipeLines(stageProc.stderr as ReadableStream<Uint8Array>, "stage");
  const p = stageProc;
  p.exited.then(async (code) => {
    await Promise.all([out, err]);
    stageProc = null;
    stageName = null;
    logLine("ui", code === 0 ? `✔ ${name} finished` : `✖ ${name} failed (exit ${code})`);
    broadcast({ type: "status" });
    if (name === "setup" && code === 0 && restartAgent) startAgent();
  });
  return { ok: true };
}

// ---------- chain state, polled and cached ----------
type Role = (typeof ROLES)[number] | "funder" | "exchange";
let state: Record<string, unknown> = { ready: false };

async function readState() {
  let wallets: Record<string, string> = {};
  try {
    const w = await loadWallets();
    wallets = Object.fromEntries([...ROLES, "funder" as const].map((r) => [r, w[r].address]));
    if (victimOverride) wallets.victim = victimOverride;
  } catch {
    // no demo wallets yet: the UI shows "Reset demo" first
  }
  const roles = Object.keys(wallets) as Role[];
  const [records, balances, count] = await Promise.all([
    Promise.all(roles.map((r) => pub.readContract({ address: ADDRESSES.registry, abi: ABI.registry, functionName: "getRecord", args: [wallets[r]] }).catch(() => null))),
    Promise.all(roles.map((r) => pub.readContract({ address: ADDRESSES.token, abi: ABI.token, functionName: "balanceOf", args: [wallets[r]] }).catch(() => null))),
    pub.readContract({ address: ADDRESSES.exchange, abi: ABI.exchange, functionName: "depositCount" }).catch(() => null) as Promise<bigint | null>,
  ]);
  const nodes: Record<string, unknown> = {};
  roles.forEach((r, i) => {
    const rec = records[i] as { verdict: number; behaviors: number; reportHash: string } | null;
    nodes[r] = {
      address: wallets[r],
      verdict: rec ? Number(rec.verdict) : null,
      behaviors: rec ? Number(rec.behaviors) : 0,
      balance: balances[i] !== null ? (balances[i] as bigint).toString() : null,
    };
  });
  nodes.exchange = { address: ADDRESSES.exchange };

  const deposits: unknown[] = [];
  if (count !== null) {
    const n = Number(count);
    const idx = Array.from({ length: Math.min(n, 40) }, (_, k) => n - 1 - k).reverse();
    const rows = await Promise.all(
      idx.map((i) => pub.readContract({ address: ADDRESSES.exchange, abi: ABI.exchange, functionName: "deposits", args: [BigInt(i)] }).catch(() => null)),
    );
    rows.forEach((row, k) => {
      if (!row) return;
      const [depositor, amount, verdict, status] = row as [string, bigint, number, number];
      deposits.push({ id: idx[k], depositor, amount: amount.toString(), verdict: Number(verdict), status: Number(status) });
    });
  }
  state = {
    ready: true,
    nodes,
    deposits,
    depositCount: count !== null ? Number(count) : null,
    agentRunning: agentProc !== null,
    stageRunning: stageName,
    addresses: ADDRESSES,
    explorer: EXPLORER,
    updatedAt: Date.now(),
  };
}

async function statePoller() {
  for (;;) {
    try {
      await readState();
      broadcast({ type: "state", state });
    } catch (e) {
      logLine("ui", `state read failed: ${(e as Error).message.split("\n")[0]}`);
    }
    await Bun.sleep(stageName ? 4000 : 2500);
  }
}

// ---------- live transfers, for the money animation ----------
async function transferWatcher() {
  let next = (await pub.getBlockNumber()) + 1n;
  for (;;) {
    await Bun.sleep(700);
    try {
      const head = await pub.getBlockNumber();
      if (head < next) continue;
      const to = head - next > 99n ? next + 99n : head;
      const logs = await pub.getLogs({ address: ADDRESSES.token, fromBlock: next, toBlock: to });
      const parsed = parseEventLogs({ abi: ABI.token, logs: logs as Log[], eventName: "Transfer" }) as unknown as {
        args: { from: string; to: string; value: bigint };
        transactionHash: string;
      }[];
      for (const l of parsed) {
        broadcast({ type: "transfer", from: l.args.from, to: l.args.to, value: l.args.value.toString(), tx: l.transactionHash });
      }
      next = to + 1n;
    } catch {
      // lagging RPC node: retry the same range next loop
    }
  }
}

// ---------- HTTP ----------
const html = Bun.file(new URL("./index.html", import.meta.url));
const PAGES: Record<string, string> = { "/victim": "victim.html", "/exchange": "exchange.html" };
const ADDR = /^0x[0-9a-fA-F]{40}$/;

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/") return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (PAGES[path]) return new Response(Bun.file(new URL("./" + PAGES[path], import.meta.url)), { headers: { "content-type": "text/html; charset=utf-8" } });

    if (path === "/api/events") {
      let ctrl: ReadableStreamDefaultController<Uint8Array>;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c;
          clients.add(c);
          for (const ev of history) c.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
          c.enqueue(enc.encode(`data: ${JSON.stringify({ type: "state", state })}\n\n`));
        },
        cancel() {
          clients.delete(ctrl);
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } });
    }

    if (path === "/api/state") return Response.json({ ...state, agentRunning: agentProc !== null, stageRunning: stageName });

    if (req.method === "POST" && path.startsWith("/api/run/")) return Response.json(await runStage(path.slice("/api/run/".length)));
    if (req.method === "POST" && /^\/api\/fund-victim\/0x[0-9a-fA-F]{40}$/.test(path)) {
      const addr = path.split("/").pop()!;
      const w = await loadWallets().catch(() => null);
      if (w && addr.toLowerCase() === w.funder.address.toLowerCase()) return Response.json({ ok: false, error: "That account is the demo onramp. Switch to another MetaMask account." });
      const res = await runStage("fund", addr);
      if (res.ok) victimOverride = addr;
      return Response.json(res);
    }
    if (req.method === "POST" && /^\/api\/rollback\/\d+$/.test(path)) return Response.json(await runStage("rollback", path.split("/").pop()));
    if (req.method === "POST" && /^\/api\/release\/\d+$/.test(path)) return Response.json(await runStage("release", path.split("/").pop()));

    // all threat reports on disk (current + earlier runs), summarized for the Threats list
    if (path === "/api/reports") {
      const { readdir } = await import("node:fs/promises");
      const dir = new URL("../reports/", import.meta.url);
      const files = (await readdir(dir)).filter((f) => /^0x[0-9a-f]{40}\.json$/.test(f));
      const rows = await Promise.all(
        files.map(async (f) => {
          const j = await Bun.file(new URL(f, dir)).json();
          return { wallet: j.wallet, verdict: j.verdict, behaviors: j.behaviors, matched: j.matched.map((m: { behavior: string }) => m.behavior), generatedAt: j.generatedAt, evidence: !!j.evidenceHash };
        }),
      );
      return Response.json(rows.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)));
    }

    if (req.method === "POST" && path === "/api/agent/start") return Response.json({ ok: startAgent() });
    if (req.method === "POST" && path === "/api/agent/stop") {
      await stopAgent();
      return Response.json({ ok: true });
    }

    if (path.startsWith("/api/report/")) {
      const addr = path.slice("/api/report/".length);
      if (!ADDR.test(addr)) return new Response("bad address", { status: 400 });
      const f = Bun.file(new URL(`../reports/${addr.toLowerCase()}.json`, import.meta.url));
      return (await f.exists()) ? new Response(f, { headers: { "content-type": "application/json" } }) : new Response("no report", { status: 404 });
    }

    return new Response("not found", { status: 404 });
  },
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    await stopAgent();
    stageProc?.kill();
    process.exit(0);
  });
}

console.log(`Ransomwhere-Gains demo UI → http://127.0.0.1:${PORT}`);
statePoller();
transferWatcher();
