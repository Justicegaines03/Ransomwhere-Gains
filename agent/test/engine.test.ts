import { describe, expect, test } from "bun:test";
import { analyze, B, Verdict, verdictFromBehaviors, type Address, type Transfer } from "../src/engine";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const E = (n: number) => BigInt(n) * 10n ** 18n;

const MINT = "0x0000000000000000000000000000000000000000" as Address;
const FUNDER = addr(0xf0);
const EXCHANGE = addr(0xe0);
const VICTIM = addr(0x1);
const CLEAN = addr(0x2);
const RANSOM = addr(0x10);
const HOPS = [addr(0x11), addr(0x12), addr(0x13), addr(0x14)];
const MERGE = addr(0x20);
const CASHOUT = addr(0x30);
const SAVER = addr(0x40); // a normal user: receives pay, keeps it
const RENTER = addr(0x41); // a normal user who pays rent right after payday

let seq = 0;
function tx(from: Address, to: Address, value: bigint, timestamp: number): Transfer {
  seq++;
  return { from, to, value, block: BigInt(seq), timestamp, txHash: `0x${seq.toString(16).padStart(64, "0")}`, logIndex: 0 };
}

/** Mirrors the staging script: setup by a known service, then the ransom and its laundering. */
function scenario(): Transfer[] {
  seq = 0;
  const t = 1_000;
  return [
    tx(MINT, FUNDER, E(1_000_000), t),
    tx(FUNDER, VICTIM, E(1_000), t + 1),
    tx(FUNDER, CLEAN, E(100), t + 2),
    tx(FUNDER, SAVER, E(500), t + 3),
    tx(FUNDER, RENTER, E(500), t + 4),
    tx(RENTER, addr(0x42), E(480), t + 30), // pays rent fast — one behavior at most
    tx(CLEAN, EXCHANGE, E(100), t + 40), // baseline deposit
    // incident
    tx(VICTIM, RANSOM, E(1_000), t + 100),
    ...HOPS.map((h, i) => tx(RANSOM, h, E(250), t + 101 + i)),
    ...HOPS.map((h, i) => tx(h, MERGE, E(250), t + 106 + i)),
    tx(MERGE, CASHOUT, E(1_000), t + 112),
  ];
}

const run = (evidence?: Map<string, `0x${string}`>) =>
  analyze({ transfers: scenario(), allowlist: [FUNDER, EXCHANGE], evidence });

describe("verdict rule", () => {
  test("0 behaviors clean, 1 suspicious, 2+ malicious, evidence alone malicious", () => {
    expect(verdictFromBehaviors(0)).toBe(Verdict.Clean);
    expect(verdictFromBehaviors(B.RAPID_PASS_THROUGH)).toBe(Verdict.Suspicious);
    expect(verdictFromBehaviors(B.RAPID_PASS_THROUGH | B.SPLIT_AND_MERGE)).toBe(Verdict.Malicious);
    expect(verdictFromBehaviors(B.RANSOM_NOTE_EVIDENCE)).toBe(Verdict.Malicious);
  });
});

describe("staged ransom", () => {
  const r = run(new Map([[RANSOM, "0xabc" as `0x${string}`]]));
  const v = (a: Address) => r.get(a.toLowerCase())?.verdict ?? Verdict.Clean;
  const has = (a: Address, bit: number) => ((r.get(a.toLowerCase())?.behaviors ?? 0) & bit) !== 0;

  test("bystanders stay clean", () => {
    expect(v(VICTIM)).toBe(Verdict.Clean);
    expect(v(CLEAN)).toBe(Verdict.Clean);
    expect(v(SAVER)).toBe(Verdict.Clean);
  });

  test("allowlisted services are never judged", () => {
    expect(r.has(FUNDER.toLowerCase())).toBe(false);
    expect(r.has(EXCHANGE.toLowerCase())).toBe(false);
  });

  test("ransom wallet is malicious with evidence, pass-through and split", () => {
    expect(v(RANSOM)).toBe(Verdict.Malicious);
    expect(has(RANSOM, B.RANSOM_NOTE_EVIDENCE)).toBe(true);
    expect(has(RANSOM, B.RAPID_PASS_THROUGH)).toBe(true);
    expect(has(RANSOM, B.SPLIT_AND_MERGE)).toBe(true);
  });

  test("every hop is malicious", () => {
    for (const h of HOPS) {
      expect(v(h)).toBe(Verdict.Malicious);
      expect(has(h, B.NEW_WALLET_CHAIN)).toBe(true);
    }
  });

  test("merge wallet shows many-to-one collection", () => {
    expect(v(MERGE)).toBe(Verdict.Malicious);
    expect(has(MERGE, B.MANY_TO_ONE)).toBe(true);
    expect(has(MERGE, B.SPLIT_AND_MERGE)).toBe(true);
  });

  test("the cash-out wallet is flagged before it ever forwards anything", () => {
    expect(v(CASHOUT)).toBe(Verdict.Malicious);
    expect(has(CASHOUT, B.TAINTED_BY_FLAGGED)).toBe(true);
    expect(has(CASHOUT, B.NEW_WALLET_CHAIN)).toBe(true);
  });

  test("a fast rent payment is at most suspicious, never malicious", () => {
    expect(v(RENTER)).not.toBe(Verdict.Malicious);
  });

  test("findings carry readable detail and tx evidence", () => {
    const f = r.get(RANSOM.toLowerCase())!.findings.find((x) => x.behavior === "RAPID_PASS_THROUGH")!;
    expect(f.detail).toContain("100.0%");
    expect(f.txs.length).toBeGreaterThan(1);
  });
});

describe("behavior alone, without the ransom note", () => {
  test("laundering pattern is still caught on brand-new addresses", () => {
    const r = run();
    expect(r.get(MERGE.toLowerCase())!.verdict).toBe(Verdict.Malicious);
    expect(r.get(CASHOUT.toLowerCase())!.verdict).toBe(Verdict.Malicious);
    expect(r.get(RANSOM.toLowerCase())!.verdict).toBe(Verdict.Malicious);
  });
});
