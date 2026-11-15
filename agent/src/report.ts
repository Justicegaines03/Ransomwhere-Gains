// Threat report per flagged wallet: the JSON is canonical (its keccak256 goes onchain), the Markdown is for humans.
import { keccak256, toBytes } from "viem";
import { EXPLORER } from "./config";
import { BEHAVIOR_INFO, fmt, short, Verdict, type Transfer, type WalletResult } from "./engine";

const REPORT_DIR = new URL("../reports/", import.meta.url);
export const VERDICT_NAME = ["CLEAN", "SUSPICIOUS", "MALICIOUS"] as const;

export interface Report {
  wallet: string;
  verdict: (typeof VERDICT_NAME)[number];
  behaviors: number;
  matched: { behavior: string; title: string; source: string; detail: string; txs: string[] }[];
  timeline: { time: string; direction: "in" | "out"; counterparty: string; amount: string; tx: string }[];
  evidenceHash: string | null;
  chainId: number;
  generatedAt: string;
}

export function buildReport(r: WalletResult, transfers: Transfer[]): { report: Report; hash: `0x${string}` } {
  const w = r.wallet.toLowerCase();
  const timeline = transfers
    .filter((t) => t.from.toLowerCase() === w || t.to.toLowerCase() === w)
    .map((t) => {
      const incoming = t.to.toLowerCase() === w;
      return {
        time: new Date(t.timestamp * 1000).toISOString(),
        direction: (incoming ? "in" : "out") as "in" | "out",
        counterparty: incoming ? t.from : t.to,
        amount: fmt(t.value),
        tx: t.txHash,
      };
    });
  const report: Report = {
    wallet: r.wallet,
    verdict: VERDICT_NAME[r.verdict],
    behaviors: r.behaviors,
    matched: r.findings.map((f) => ({ behavior: f.behavior, ...BEHAVIOR_INFO[f.behavior], detail: f.detail, txs: f.txs })),
    timeline,
    evidenceHash: r.evidenceHash ?? null,
    chainId: 10143,
    generatedAt: new Date().toISOString(),
  };
  return { report, hash: keccak256(toBytes(JSON.stringify(report))) };
}

export function toMarkdown(rep: Report, hash: string, postedTx?: string): string {
  const tx = (h: string) => `[${h.slice(0, 10)}…](${EXPLORER}/tx/${h})`;
  const lines = [
    `# Threat report — ${rep.wallet}`,
    "",
    `**Verdict: ${rep.verdict}** · ${rep.matched.length} behavior(s) matched · Monad testnet · ${rep.generatedAt}`,
    "",
    "## Matched behaviors",
    "",
    ...rep.matched.flatMap((m) => [
      `- **${m.title}**: ${m.detail}`,
      `  - Source: ${m.source}`,
      ...(m.txs.length ? [`  - Evidence: ${m.txs.slice(0, 6).map(tx).join(", ")}${m.txs.length > 6 ? ` +${m.txs.length - 6} more` : ""}`] : []),
    ]),
    "",
    "## Money timeline",
    "",
    "| Time (UTC) | Direction | Counterparty | Amount | Tx |",
    "|---|---|---|---|---|",
    ...rep.timeline.map((t) => `| ${t.time.slice(11, 19)} | ${t.direction === "in" ? "← in" : "→ out"} | \`${short(t.counterparty)}\` | ${t.amount} | ${tx(t.tx)} |`),
    "",
    "## Fingerprints",
    "",
    `- Report hash (onchain): \`${hash}\``,
    `- Evidence hash: ${rep.evidenceHash ? `\`${rep.evidenceHash}\`` : "none"}`,
    ...(postedTx ? [`- Verdict transaction: ${tx(postedTx)}`] : []),
    "",
    "_Verdict rule: 0 behaviors clean, 1 suspicious, 2+ (or attached ransom-note evidence) malicious._",
    "",
  ];
  return lines.join("\n");
}

export async function writeReport(rep: Report, hash: string, postedTx?: string) {
  const base = new URL(rep.wallet, REPORT_DIR);
  await Bun.write(`${base.pathname}.json`, JSON.stringify({ ...rep, reportHash: hash, verdictTx: postedTx ?? null }, null, 2) + "\n");
  await Bun.write(`${base.pathname}.md`, toMarkdown(rep, hash, postedTx));
}

export const isFlagged = (r: WalletResult) => r.verdict !== Verdict.Clean;
