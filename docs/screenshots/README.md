# Demo screenshots

Fallback visuals from the end-to-end rehearsal on Monad testnet (2026-11-15), in demo order.

| # | Screenshot | What it shows |
|---|---|---|
| 1 | [01-agent-live-verdicts.jpg](01-agent-live-verdicts.jpg) | The agent flagging the ransom wallet from the ransom note, then every hop, the merge and the cash-out wallet, posting each batch onchain about 1–2 s (chain time) after the transfers it covers |
| 2 | [02-clean-credited-cashout-held.jpg](02-clean-credited-cashout-held.jpg) | Baseline clean deposit **credited**; the attacker's 1,000 dUSD cash-out **held** (verdict MALICIOUS) |
| 3 | [03-threat-report-cashout.jpg](03-threat-report-cashout.jpg) | The cash-out wallet's threat report: matched behaviors with sources, money timeline, fingerprints. Rendered from `agent/reports/0x811b…8178.json` |
| 4 | [04-onchain-proof-held.jpg](04-onchain-proof-held.jpg) | Live `cast` reads: the deposit tx succeeded, `deposits(1)` is verdict 2 / status Held, withdrawable balance 0, and the registry's report hash matches the report file |

Terminal output in 1 and 2 is the real rehearsal output, restyled for readability; tx hashes in 2 are shortened except the held deposit.
Held deposit: [`0x3488bc82…`](https://testnet.monadexplorer.com/tx/0x3488bc822ded14bf37fa5e0c59c3997f0f285e2f880ec0a7e131078afe232355) · 7-verdict batch: [`0x413941a1…`](https://testnet.monadexplorer.com/tx/0x413941a1affdcc4cd506d7d825c025a9467716b4573232439d9cf6024359b5ce)

## Demo UI (`bun run ui`)

| # | Screenshot | What it shows |
|---|---|---|
| 5 | [05-ui-incident-flagged.jpg](05-ui-incident-flagged.jpg) | After **Run incident**: every laundering wallet red, money edges lit, registry shows the last verdict, latency badge 3 s |
| 6 | [06-ui-deposit-held.jpg](06-ui-deposit-held.jpg) | After **Cash out**: full-screen DEPOSIT HELD banner, deposits table HELD vs CREDITED |

## EDR console (`bun run ui`, current)

| # | Screenshot | What it shows |
|---|---|---|
| 7 | [07-console-incident-flagged.jpg](07-console-incident-flagged.jpg) | After **Run incident**: 7 threats, every laundering wallet red on the money trail, 2 s to verdict |
| 8 | [08-console-deposit-held.jpg](08-console-deposit-held.jpg) | After **Attempt cash-out**: "Threat mitigated / Deposit held", funds held 1,000 dUSD, cash-out wallet status Funds held |
| 9 | [09-console-laundering-matrix.jpg](09-console-laundering-matrix.jpg) | Laundering matrix for the cash-out wallet: matched behaviors by stage |

Screenshots 5–6 show the first, simpler UI (tag `v2-ui-simple`).

## Sender views

| # | Screenshot | What it shows |
|---|---|---|
| 10 | [10-victim-ransom-screen.jpg](10-victim-ransom-screen.jpg) | `/victim`: the staged ransom screen. Connect MetaMask, then Send payment is a real transfer to the ransom wallet |
| 11 | [11-exchange-deposit-on-hold.jpg](11-exchange-deposit-on-hold.jpg) | `/exchange?as=cashout`: what the attacker sees when the exchange holds the deposit |

## Rollback

| # | Screenshot | What it shows |
|---|---|---|
| 12 | [12-console-response-rollback-action.jpg](12-console-response-rollback-action.jpg) | Response tab on the held cash-out deposit: **Roll back to victim** |
| 13 | [13-console-rolled-back.jpg](13-console-rolled-back.jpg) | After the rollback: funds held 0, returned to victims 1,000 dUSD, cash-out wallet status Rolled back |
