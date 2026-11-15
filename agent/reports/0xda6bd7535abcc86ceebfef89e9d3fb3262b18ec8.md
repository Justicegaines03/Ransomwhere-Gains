# Threat report — 0xda6bd7535abcc86ceebfef89e9d3fb3262b18ec8

**Verdict: MALICIOUS** · 3 behavior(s) matched · Monad testnet · 2026-11-15T23:15:07.122Z

## Matched behaviors

- **Rapid pass-through**: Forwarded 100.0% of a 250 dUSD receipt within 1s
  - Source: FATF 2023 Countering Ransomware Financing; FATF 2020 VA Red Flags (rapid movement of funds) — to confirm
  - Evidence: [0xfc808bd8…](https://testnet.monadexplorer.com/tx/0xfc808bd87c1d5e59346b867c7d476939bbd30806ecd117fb08e8b2e64dc336a0), [0xe4487a71…](https://testnet.monadexplorer.com/tx/0xe4487a71a74503577381fbf6cec5ffdf19c8a639ff38dbbe4e297437018db0e5)
- **Split and merge**: 0x3555…4541 split to 4 wallets; 2 recombined into 0x6436…8380
  - Source: FATF 2023 Countering Ransomware Financing (layering via splitting and consolidation) — to confirm
  - Evidence: [0xfc808bd8…](https://testnet.monadexplorer.com/tx/0xfc808bd87c1d5e59346b867c7d476939bbd30806ecd117fb08e8b2e64dc336a0), [0xe006446e…](https://testnet.monadexplorer.com/tx/0xe006446e6765f44d4a9cc8420426ad67c5bc705b5f0fbfca507b89be363a56f7), [0xffdf213b…](https://testnet.monadexplorer.com/tx/0xffdf213ba161d7e11acac11c2246b3143a1a675e04a5e2f65d6145147991005f), [0x9eb29d61…](https://testnet.monadexplorer.com/tx/0x9eb29d6147e8342676b4e9f22c134de18059f04b93427b31ac95d540b6b37355), [0xe4487a71…](https://testnet.monadexplorer.com/tx/0xe4487a71a74503577381fbf6cec5ffdf19c8a639ff38dbbe4e297437018db0e5), [0xfd4c6e05…](https://testnet.monadexplorer.com/tx/0xfd4c6e0544d9057ef5eb8614f089adf579d10fe4642b4e4ff1bc1ac9188e6930)
- **Received funds from a malicious wallet**: Received 250 dUSD from malicious wallet 0x3555…4541
  - Source: Downstream propagation (pilot rule)
  - Evidence: [0xfc808bd8…](https://testnet.monadexplorer.com/tx/0xfc808bd87c1d5e59346b867c7d476939bbd30806ecd117fb08e8b2e64dc336a0)

## Money timeline

| Time (UTC) | Direction | Counterparty | Amount | Tx |
|---|---|---|---|---|
| 23:15:02 | ← in | `0x3555…4541` | 250 dUSD | [0xfc808bd8…](https://testnet.monadexplorer.com/tx/0xfc808bd87c1d5e59346b867c7d476939bbd30806ecd117fb08e8b2e64dc336a0) |
| 23:15:03 | → out | `0x6436…8380` | 250 dUSD | [0xe4487a71…](https://testnet.monadexplorer.com/tx/0xe4487a71a74503577381fbf6cec5ffdf19c8a639ff38dbbe4e297437018db0e5) |

## Fingerprints

- Report hash (onchain): `0x3ddc306b18f99044e29b349d3661b9d5c56884373ee72327b09c7f27cf09663d`
- Evidence hash: none
- Verdict transaction: [0xb6b50b6a…](https://testnet.monadexplorer.com/tx/0xb6b50b6a8cb1e2a6026d2351860d03973d1f2f1e6e2fdcf31a5abfaaf7362c46)

_Verdict rule: 0 behaviors clean, 1 suspicious, 2+ (or attached ransom-note evidence) malicious._
