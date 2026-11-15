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
