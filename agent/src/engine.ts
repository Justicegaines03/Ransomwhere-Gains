// Detection engine: plain, explainable rules over a token's transfer graph.
// Pure functions only — no chain access — so every verdict is reproducible from the transfers alone.

export type Address = `0x${string}`;

export interface Transfer {
  from: Address;
  to: Address;
  value: bigint;
  block: bigint;
  timestamp: number; // unix seconds
  txHash: `0x${string}`;
  logIndex: number;
}

export enum Verdict {
  Clean = 0,
  Suspicious = 1,
  Malicious = 2,
}

// Must match VerdictRegistry.sol
export const B = {
  RAPID_PASS_THROUGH: 1 << 0,
  NEW_WALLET_CHAIN: 1 << 1,
  SPLIT_AND_MERGE: 1 << 2,
  MANY_TO_ONE: 1 << 3,
  TAINTED_BY_FLAGGED: 1 << 4,
  RANSOM_NOTE_EVIDENCE: 1 << 5,
} as const;
export type BehaviorName = keyof typeof B;

/**
 * Framework tags. Source documents are named; the exact indicator wording is still
 * TO CONFIRM against the published lists before anyone quotes an indicator number.
 */
export const BEHAVIOR_INFO: Record<BehaviorName, { title: string; source: string }> = {
  RAPID_PASS_THROUGH: {
    title: "Rapid pass-through",
    source: "FATF 2023 Countering Ransomware Financing; FATF 2020 VA Red Flags (rapid movement of funds) — to confirm",
  },
  NEW_WALLET_CHAIN: {
    title: "New-wallet chain",
    source: "FATF 2020 VA Red Flags (funds moved through newly created wallets) — to confirm",
  },
  SPLIT_AND_MERGE: {
    title: "Split and merge",
    source: "FATF 2023 Countering Ransomware Financing (layering via splitting and consolidation) — to confirm",
  },
  MANY_TO_ONE: {
    title: "Many-to-one collection",
    source: "FinCEN 2021 Ransomware Advisory (structuring / aggregation patterns) — to confirm",
  },
  TAINTED_BY_FLAGGED: {
    title: "Received funds from a malicious wallet",
    source: "Downstream propagation (pilot rule)",
  },
  RANSOM_NOTE_EVIDENCE: {
    title: "Named in a ransom note",
    source: "Offchain evidence attached by the reporter",
  },
};

export interface Params {
  windowSec: number; // how fast counts as "rapid"
  passThroughRatio: number; // share of an inbound amount forwarded within the window
  splitMinRecipients: number;
  mergeMinSenders: number;
  manyToOneMinSenders: number;
  similarityTolerance: number; // ±share around the median for "similar amounts"
}

export const DEFAULT_PARAMS: Params = {
  windowSec: 600,
  passThroughRatio: 0.9,
  splitMinRecipients: 3,
  mergeMinSenders: 2,
  manyToOneMinSenders: 3,
  similarityTolerance: 0.1,
};

export interface Finding {
  behavior: BehaviorName;
  detail: string;
  txs: `0x${string}`[];
}

export interface WalletResult {
  wallet: Address;
  verdict: Verdict;
  behaviors: number; // bitmask
  findings: Finding[];
  evidenceHash?: `0x${string}`;
}

export interface Input {
  transfers: Transfer[];
  /** Known services (onramps, exchanges, the token minter). Never judged; funds from them are a clean origin. */
  allowlist: Iterable<string>;
  /** Wallets named in offchain evidence, mapped to the evidence fingerprint. */
  evidence?: Map<string, `0x${string}`>;
  params?: Partial<Params>;
}

const ZERO = "0x0000000000000000000000000000000000000000";
const lc = (a: string) => a.toLowerCase();

export function verdictFromBehaviors(behaviors: number): Verdict {
  if (behaviors & B.RANSOM_NOTE_EVIDENCE) return Verdict.Malicious;
  let n = 0;
  for (const bit of Object.values(B)) if (behaviors & bit) n++;
  if (n >= 2) return Verdict.Malicious;
  if (n === 1) return Verdict.Suspicious;
  return Verdict.Clean;
}

export function analyze(input: Input): Map<string, WalletResult> {
  const p = { ...DEFAULT_PARAMS, ...input.params };
  const allow = new Set([...input.allowlist].map(lc));
  allow.add(ZERO);
  const evidence = new Map([...(input.evidence ?? new Map())].map(([k, v]) => [lc(k), v]));

  const txs = [...input.transfers].sort((a, b) =>
    a.block === b.block ? a.logIndex - b.logIndex : a.block < b.block ? -1 : 1,
  );

  const inbound = new Map<string, Transfer[]>();
  const outbound = new Map<string, Transfer[]>();
  const firstSeen = new Map<string, Transfer>();
  for (const t of txs) {
    const f = lc(t.from), to = lc(t.to);
    (outbound.get(f) ?? outbound.set(f, []).get(f)!).push(t);
    (inbound.get(to) ?? inbound.set(to, []).get(to)!).push(t);
    if (!firstSeen.has(f)) firstSeen.set(f, t);
    if (!firstSeen.has(to)) firstSeen.set(to, t);
  }

  const subjects = [...firstSeen.keys()].filter((w) => !allow.has(w));
  const findings = new Map<string, Finding[]>(subjects.map((w) => [w, []]));
  const add = (w: string, f: Finding) => {
    const list = findings.get(w);
    if (list && !list.some((x) => x.behavior === f.behavior)) list.push(f);
  };

  // A "new" wallet: its first-ever token activity is money arriving from a non-service.
  const isNew = (w: string) => {
    const first = firstSeen.get(w);
    return !!first && lc(first.to) === w && !allow.has(lc(first.from));
  };

  for (const w of subjects) {
    const ins = inbound.get(w) ?? [];
    const outs = outbound.get(w) ?? [];

    // Rapid pass-through
    for (const t of ins) {
      if (allow.has(lc(t.from))) continue;
      const fwd = outs.filter((o) => o.timestamp >= t.timestamp && o.timestamp <= t.timestamp + p.windowSec && o.block >= t.block);
      const sent = fwd.reduce((s, o) => s + o.value, 0n);
      if (t.value > 0n && Number((sent * 10_000n) / t.value) / 10_000 >= p.passThroughRatio) {
        const secs = Math.max(...fwd.map((o) => o.timestamp)) - t.timestamp;
        add(w, {
          behavior: "RAPID_PASS_THROUGH",
          detail: `Forwarded ${pct(sent, t.value)} of a ${fmt(t.value)} receipt within ${secs}s`,
          txs: [t.txHash, ...fwd.map((o) => o.txHash)],
        });
        break;
      }
    }

    // New-wallet chain: a new wallet funded by another new wallet
    if (isNew(w)) {
      const first = firstSeen.get(w)!;
      if (isNew(lc(first.from))) {
        add(w, {
          behavior: "NEW_WALLET_CHAIN",
          detail: `No history before receiving from ${short(first.from)}, which also had no history`,
          txs: [first.txHash],
        });
      }
    }

    // Many-to-one collection
    if (isNew(w)) {
      const senders = new Map<string, Transfer>();
      for (const t of ins) if (!allow.has(lc(t.from)) && !senders.has(lc(t.from))) senders.set(lc(t.from), t);
      if (senders.size >= p.manyToOneMinSenders) {
        const vals = [...senders.values()].map((t) => t.value).sort((a, b) => (a < b ? -1 : 1));
        const median = vals[Math.floor(vals.length / 2)];
        const similar = [...senders.values()].filter((t) => within(t.value, median, p.similarityTolerance));
        const span = Math.max(...similar.map((t) => t.timestamp)) - Math.min(...similar.map((t) => t.timestamp));
        if (similar.length >= p.manyToOneMinSenders && span <= p.windowSec) {
          add(w, {
            behavior: "MANY_TO_ONE",
            detail: `${similar.length} senders paid ~${fmt(median)} each into this new wallet within ${span}s`,
            txs: similar.map((t) => t.txHash),
          });
        }
      }
    }
  }

  // Split and merge: one wallet fans out, and at least two of the branches recombine.
  for (const s of subjects) {
    const outs = (outbound.get(s) ?? []).filter((o) => !allow.has(lc(o.to)));
    const recipients = [...new Set(outs.map((o) => lc(o.to)))];
    if (recipients.length < p.splitMinRecipients) continue;
    const t0 = Math.min(...outs.map((o) => o.timestamp));
    const mergeCounts = new Map<string, Transfer[]>();
    for (const r of recipients) {
      for (const o of outbound.get(r) ?? []) {
        if (allow.has(lc(o.to)) || o.timestamp > t0 + p.windowSec) continue;
        const m = lc(o.to);
        (mergeCounts.get(m) ?? mergeCounts.set(m, []).get(m)!).push(o);
      }
    }
    for (const [m, legs] of mergeCounts) {
      const branches = [...new Set(legs.map((l) => lc(l.from)))];
      if (branches.length < p.mergeMinSenders) continue;
      const detail = `${short(s)} split to ${recipients.length} wallets; ${branches.length} recombined into ${short(m)}`;
      const txHashes = [...outs.map((o) => o.txHash), ...legs.map((l) => l.txHash)];
      for (const w of [s, ...branches, m]) add(w, { behavior: "SPLIT_AND_MERGE", detail, txs: txHashes });
    }
  }

  // Offchain evidence
  for (const [w, hash] of evidence) {
    if (findings.has(w)) add(w, { behavior: "RANSOM_NOTE_EVIDENCE", detail: `Evidence fingerprint ${hash}`, txs: [] });
  }

  // Downstream taint, iterated to a fixed point: money leaving a malicious wallet carries the flag.
  const bitsOf = (w: string) => (findings.get(w) ?? []).reduce((m, f) => m | B[f.behavior], 0);
  let changed = true;
  while (changed) {
    changed = false;
    for (const w of subjects) {
      if (verdictFromBehaviors(bitsOf(w)) !== Verdict.Malicious) continue;
      for (const o of outbound.get(w) ?? []) {
        const r = lc(o.to);
        if (allow.has(r) || !findings.has(r) || bitsOf(r) & B.TAINTED_BY_FLAGGED) continue;
        add(r, {
          behavior: "TAINTED_BY_FLAGGED",
          detail: `Received ${fmt(o.value)} from malicious wallet ${short(o.from)}`,
          txs: [o.txHash],
        });
        changed = true;
      }
    }
  }

  const out = new Map<string, WalletResult>();
  for (const w of subjects) {
    const behaviors = bitsOf(w);
    out.set(w, {
      wallet: w as Address,
      verdict: verdictFromBehaviors(behaviors),
      behaviors,
      findings: findings.get(w)!,
      evidenceHash: evidence.get(w),
    });
  }
  return out;
}

function within(v: bigint, ref: bigint, tol: number): boolean {
  if (ref === 0n) return v === 0n;
  const diff = v > ref ? v - ref : ref - v;
  return Number((diff * 10_000n) / ref) / 10_000 <= tol;
}
const pct = (a: bigint, b: bigint) => `${(Number((a * 1000n) / b) / 10).toFixed(1)}%`;
export const fmt = (v: bigint) => `${(Number(v / 10n ** 14n) / 10_000).toLocaleString("en-US")} dUSD`;
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
