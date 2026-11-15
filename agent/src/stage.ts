// Staging script: replays a ransom payment and its laundering on Monad testnet with wallets we created.
//   bun run setup [--fresh]   create demo wallets, fund gas, hand the registry to the agent, write the ransom note
//   bun run clean-deposit     baseline: a clean wallet deposits at the exchange and is credited
//   bun run incident          victim pays the ransom; attacker splits it, merges it, moves it to a cash-out wallet
//   bun run src/stage.ts pay | launder   the same incident as two separate steps (used by the demo UI)
//   bun run cashout           the cash-out wallet tries to deposit at the exchange
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  keccak256,
  parseEther,
  toBytes,
  type Hash,
  type PrivateKeyAccount,
} from "viem";
import { ABI, ADDRESSES, EXPLORER, monadTestnet, rpc } from "./config";
import { loadWallets, ROLES, type Wallets } from "./wallets";

const pub = createPublicClient({ chain: monadTestnet, transport: rpc() });
const wallet = (account: PrivateKeyAccount) => createWalletClient({ account, chain: monadTestnet, transport: rpc() });

const D = (n: number) => BigInt(n) * 10n ** 18n; // dUSD has 18 decimals
const RANSOM_AMOUNT = D(1_000);
const HOP_COUNT = 4;

const STATE_FILE = new URL("../state.json", import.meta.url);
const SCAN_FROM_FILE = new URL("../scan-from.json", import.meta.url);
// One note per ransom wallet: a new setup must never erase the evidence for an earlier incident.
const noteFile = (ransom: string) => new URL(`../evidence/ransom-note-${ransom.toLowerCase().slice(0, 10)}.txt`, import.meta.url);

const now = () => new Date().toISOString().slice(11, 23);
const log = (msg: string) => console.log(`[${now()}] ${msg}`);
const link = (h: Hash) => `${EXPLORER}/tx/${h}`;

async function confirm(h: Hash, label: string) {
  const r = await pub.waitForTransactionReceipt({ hash: h });
  if (r.status !== "success") throw new Error(`${label} reverted: ${link(h)}`);
  log(`${label}  ${link(h)}`);
  return r;
}

async function transferToken(from: PrivateKeyAccount, to: `0x${string}`, amount: bigint, nonce?: number) {
  return wallet(from).writeContract({
    address: ADDRESSES.token,
    abi: ABI.token,
    functionName: "transfer",
    args: [to, amount],
    nonce,
  });
}

async function setup(w: Wallets) {
  const f = w.funder;
  // The agent only needs history from the moment these wallets were created (see agent.ts).
  const scanFile = Bun.file(SCAN_FROM_FILE);
  if (process.argv.includes("--fresh") || !(await scanFile.exists())) {
    await Bun.write(SCAN_FROM_FILE, JSON.stringify({ block: (await pub.getBlockNumber()).toString() }) + "\n");
  }
  log(`funder ${f.address}  MON ${formatEther(await pub.getBalance({ address: f.address }))}`);

  // 1. Gas for every demo wallet.
  // Seen on testnet: with the funder near Monad’s 10 MON reserve, value transfers sent back-to-back revert.
  // Below 15 MON, send one at a time and let a few blocks pass between them; above it, batch for speed.
  const slow = (await pub.getBalance({ address: f.address })) < parseEther("15");
  let nonce = await pub.getTransactionCount({ address: f.address, blockTag: "pending" });
  const gas: Hash[] = [];
  for (const r of ROLES) {
    const target = r === "agent" ? parseEther("0.6") : parseEther("0.06"); // a full run uses well under half of this
    const bal = await pub.getBalance({ address: w[r].address });
    if (bal >= target / 2n) continue;
    const h = await wallet(f).sendTransaction({ to: w[r].address, value: target - bal, nonce: nonce++ });
    if (slow) {
      await confirm(h, `gas funded (${r})`);
      await Bun.sleep(2500);
    } else gas.push(h);
  }
  for (const h of gas) await confirm(h, "gas funded");
  if (slow) await Bun.sleep(2500);

  // 2. The registry's writer becomes the dedicated agent wallet
  const current = (await pub.readContract({ address: ADDRESSES.registry, abi: ABI.registry, functionName: "agent" })) as string;
  if (current.toLowerCase() !== w.agent.address.toLowerCase()) {
    await confirm(
      await wallet(f).writeContract({
        address: ADDRESSES.registry,
        abi: ABI.registry,
        functionName: "setAgent",
        args: [w.agent.address],
        nonce: nonce++,
      }),
      `registry agent -> ${w.agent.address}`,
    );
  }

  // 3. dUSD from the onramp (funder) to the victim and the clean depositor
  for (const [r, amt] of [["victim", RANSOM_AMOUNT], ["clean", D(100)]] as const) {
    const bal = (await pub.readContract({ address: ADDRESSES.token, abi: ABI.token, functionName: "balanceOf", args: [w[r].address] })) as bigint;
    if (bal < amt) await confirm(await transferToken(f, w[r].address, amt - bal, nonce++), `${r} receives ${formatEther(amt - bal)} dUSD`);
  }

  // 4. The offchain evidence: a ransom note naming the ransom wallet
  const note = [
    "YOUR FILES HAVE BEEN ENCRYPTED.",
    "",
    `To recover them, send ${formatEther(RANSOM_AMOUNT)} dUSD on Monad to:`,
    `  ${w.ransom.address}`,
    "",
    "You have 48 hours.",
    "",
    "(Staged for the Ransomwhere-Gains demo on Monad testnet. Not a real attack.)",
    "",
  ].join("\n");
  await Bun.write(noteFile(w.ransom.address), note);
  log(`ransom note written: agent/evidence/ransom-note-${w.ransom.address.toLowerCase().slice(0, 10)}.txt  fingerprint ${keccak256(toBytes(note))}`);

  console.log("\nDemo wallets:");
  for (const r of ROLES) console.log(`  ${r.padEnd(8)} ${w[r].address}`);
}

async function depositAtExchange(from: PrivateKeyAccount, amount: bigint, label: string) {
  await confirm(
    await wallet(from).writeContract({ address: ADDRESSES.token, abi: ABI.token, functionName: "approve", args: [ADDRESSES.exchange, amount] }),
    `${label} approves exchange`,
  );
  const verdict = (await pub.readContract({ address: ADDRESSES.registry, abi: ABI.registry, functionName: "verdictOf", args: [from.address] })) as number;
  const h = await wallet(from).writeContract({ address: ADDRESSES.exchange, abi: ABI.exchange, functionName: "deposit", args: [amount] });
  const r = await confirm(h, `${label} deposits ${formatEther(amount)} dUSD`);
  const held = r.logs.some((l) => l.address.toLowerCase() === ADDRESSES.exchange.toLowerCase() && l.topics[0] === HELD_TOPIC);
  const name = ["CLEAN", "SUSPICIOUS", "MALICIOUS"][verdict];
  console.log(held ? `\n  >>> DEPOSIT HELD — registry verdict ${name}\n` : `\n  >>> DEPOSIT CREDITED — registry verdict ${name}\n`);
}

const HELD_TOPIC = keccak256(toBytes("DepositHeld(uint256,address,uint256,uint8)"));

/** The victim pays the ransom named in the note. */
async function pay(w: Wallets) {
  console.log("\n== Victim pays the ransom ==");
  await confirm(await transferToken(w.victim, w.ransom.address, RANSOM_AMOUNT), `victim -> ransom ${formatEther(RANSOM_AMOUNT)} dUSD`);
}

/** The attacker launders it: split across new wallets, recombine, move to a cash-out wallet. */
async function launder(w: Wallets) {
  const hops = [w.hop1, w.hop2, w.hop3, w.hop4].slice(0, HOP_COUNT);
  const share = RANSOM_AMOUNT / BigInt(HOP_COUNT);

  console.log("\n== Attacker splits it across new wallets ==");
  const n = await pub.getTransactionCount({ address: w.ransom.address, blockTag: "pending" });
  const splits = await Promise.all(hops.map((h, i) => transferToken(w.ransom, h.address, share, n + i)));
  for (const [i, h] of splits.entries()) await confirm(h, `ransom -> hop${i + 1} ${formatEther(share)} dUSD`);

  console.log("\n== ...and recombines it ==");
  const merges = await Promise.all(hops.map((h) => transferToken(h, w.merge.address, share)));
  for (const [i, h] of merges.entries()) await confirm(h, `hop${i + 1} -> merge ${formatEther(share)} dUSD`);

  console.log("\n== Moves it to the cash-out wallet ==");
  const last = await confirm(await transferToken(w.merge, w.cashout.address, RANSOM_AMOUNT), `merge -> cashout ${formatEther(RANSOM_AMOUNT)} dUSD`);

  await Bun.write(STATE_FILE, JSON.stringify({ lastHopBlock: last.blockNumber.toString(), lastHopAt: Date.now() }, null, 2));
  log("laundering staged. Watch the agent, then run: bun run cashout");
}

/** Both steps in one command (the original CLI demo). */
async function incident(w: Wallets) {
  await pay(w);
  await launder(w);
}

/** Top up an external victim wallet (e.g. a MetaMask account) so it can pay the ransom itself. */
async function fund(w: Wallets, addr: string | undefined) {
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error("usage: bun run src/stage.ts fund <address>");
  const to = addr as `0x${string}`;
  if (to.toLowerCase() === w.funder.address.toLowerCase()) throw new Error("that address is the onramp itself");
  const bal = (await pub.readContract({ address: ADDRESSES.token, abi: ABI.token, functionName: "balanceOf", args: [to] })) as bigint;
  if (bal < RANSOM_AMOUNT) await confirm(await transferToken(w.funder, to, RANSOM_AMOUNT - bal), `victim wallet receives ${formatEther(RANSOM_AMOUNT - bal)} dUSD`);
  const gas = await pub.getBalance({ address: to });
  if (gas < parseEther("0.1")) await Bun.sleep(2500); // same reserve rule: keep the value transfer apart from the token transfer
  if (gas < parseEther("0.1")) await confirm(await wallet(w.funder).sendTransaction({ to, value: parseEther("0.3") - gas }), "victim wallet gas funded");
  log(`victim wallet ${to} ready`);
}

/** Response action: compliance review clears a held deposit (false positive). Signed by the exchange owner (funder). */
async function release(w: Wallets, idArg: string | undefined) {
  if (!idArg || !/^\d+$/.test(idArg)) throw new Error("usage: bun run src/stage.ts release <depositId>");
  const id = BigInt(idArg);
  const [depositor, amount, , status] = (await pub.readContract({
    address: ADDRESSES.exchange,
    abi: ABI.exchange,
    functionName: "deposits",
    args: [id],
  })) as [string, bigint, number, number];
  if (Number(status) !== 1) throw new Error(`deposit ${id} is not held (status ${status})`);
  await confirm(
    await wallet(w.funder).writeContract({ address: ADDRESSES.exchange, abi: ABI.exchange, functionName: "release", args: [id] }),
    `deposit ${id} released: ${formatEther(amount)} dUSD credited to ${depositor}`,
  );
  console.log(`\n  >>> DEPOSIT RELEASED — reviewed as false positive\n`);
}

/**
 * Rollback: return a held deposit to the victim. The victim is whoever paid the ransom wallet,
 * read from the agent’s own threat report for that wallet (the evidence trail), not typed in by hand.
 */
async function rollback(w: Wallets, idArg: string | undefined) {
  if (!idArg || !/^\d+$/.test(idArg)) throw new Error("usage: bun run src/stage.ts rollback <depositId>");
  const id = BigInt(idArg);
  const [, amount, , status] = (await pub.readContract({ address: ADDRESSES.exchange, abi: ABI.exchange, functionName: "deposits", args: [id] })) as [string, bigint, number, number];
  if (Number(status) !== 1) throw new Error(`deposit ${id} is not held (status ${status})`);
  const report = Bun.file(new URL(`../reports/${w.ransom.address.toLowerCase()}.json`, import.meta.url));
  if (!(await report.exists())) throw new Error("no threat report for the ransom wallet yet: cannot identify the victim");
  const paid = ((await report.json()).timeline as { direction: string; counterparty: string }[]).find((t) => t.direction === "in");
  if (!paid || !/^0x[0-9a-fA-F]{40}$/.test(paid.counterparty)) throw new Error("the ransom wallet’s report has no incoming payment");
  const victim = paid.counterparty as `0x${string}`;
  await confirm(
    await wallet(w.funder).writeContract({ address: ADDRESSES.exchange, abi: ABI.exchange, functionName: "rollback", args: [id, victim] }),
    `deposit ${id} rolled back: ${formatEther(amount)} dUSD returned to victim ${victim}`,
  );
  console.log(`\n  >>> DEPOSIT ROLLED BACK — ${formatEther(amount)} dUSD returned to the victim\n`);
}

const cmd = process.argv[2];
const fresh = process.argv.includes("--fresh");
const w = await loadWallets({ create: cmd === "setup", fresh });

if (cmd === "setup") await setup(w);
else if (cmd === "clean") await depositAtExchange(w.clean, D(100), "clean wallet");
else if (cmd === "incident") await incident(w);
else if (cmd === "pay") await pay(w);
else if (cmd === "fund") await fund(w, process.argv[3]);
else if (cmd === "launder") await launder(w);
else if (cmd === "cashout") await depositAtExchange(w.cashout, RANSOM_AMOUNT, "cash-out wallet");
else if (cmd === "release") await release(w, process.argv[3]);
else if (cmd === "rollback") await rollback(w, process.argv[3]);
else {
  console.error("usage: bun run src/stage.ts setup [--fresh] | clean | pay | launder | incident | cashout | release <depositId> | rollback <depositId>");
  process.exit(1);
}
