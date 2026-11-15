# Threat report — 0xb7d02c7780dfe7dfc6405eebecbdf67d4fce1f78

**Verdict: MALICIOUS** · 3 behavior(s) matched · Monad testnet · 2026-11-15T22:20:34.236Z

## Matched behaviors

- **Rapid pass-through**: Forwarded 100.0% of a 250 dUSD receipt within 1s
  - Source: FATF 2023 Countering Ransomware Financing; FATF 2020 VA Red Flags (rapid movement of funds) — to confirm
  - Evidence: [0x1749f704…](https://testnet.monadexplorer.com/tx/0x1749f704cc34637bb09735cd90385d5e0533e0384341858746f48fdd0498dbd4), [0x440d49ad…](https://testnet.monadexplorer.com/tx/0x440d49ad71f0e024666b99615f0d2cea6fd7e97cf32c1216844ebc529af367e5)
- **Split and merge**: 0xba89…b94b split to 4 wallets; 4 recombined into 0xb8f0…771f
  - Source: FATF 2023 Countering Ransomware Financing (layering via splitting and consolidation) — to confirm
  - Evidence: [0xa6cb60a5…](https://testnet.monadexplorer.com/tx/0xa6cb60a5fc8e577dc7893117bab610e19f24ac3bc9faa76e9f47c2bd893fe23c), [0x8ac2ebcf…](https://testnet.monadexplorer.com/tx/0x8ac2ebcf02f66e5c6e09b6f3a0143a6f096c0a0c4b1c434b23608199e526bb77), [0x1749f704…](https://testnet.monadexplorer.com/tx/0x1749f704cc34637bb09735cd90385d5e0533e0384341858746f48fdd0498dbd4), [0x6cecc24b…](https://testnet.monadexplorer.com/tx/0x6cecc24b0d62361a1a3d105a0e2602ee40985f8f46dd2510c5484ba8e30266a0), [0xe57aae7c…](https://testnet.monadexplorer.com/tx/0xe57aae7cb2d1f3a67b9fa36b32e293d65af81e5f80bac3cb6de72cf051226403), [0xdb685a95…](https://testnet.monadexplorer.com/tx/0xdb685a957bbc696b6bbe8d849a3acfc06d287659c1f6e31284f620231270bc2a) +2 more
- **Received funds from a malicious wallet**: Received 250 dUSD from malicious wallet 0xba89…b94b
  - Source: Downstream propagation (pilot rule)
  - Evidence: [0x1749f704…](https://testnet.monadexplorer.com/tx/0x1749f704cc34637bb09735cd90385d5e0533e0384341858746f48fdd0498dbd4)

## Money timeline

| Time (UTC) | Direction | Counterparty | Amount | Tx |
|---|---|---|---|---|
| 22:20:31 | ← in | `0xba89…b94b` | 250 dUSD | [0x1749f704…](https://testnet.monadexplorer.com/tx/0x1749f704cc34637bb09735cd90385d5e0533e0384341858746f48fdd0498dbd4) |
| 22:20:32 | → out | `0xb8F0…771f` | 250 dUSD | [0x440d49ad…](https://testnet.monadexplorer.com/tx/0x440d49ad71f0e024666b99615f0d2cea6fd7e97cf32c1216844ebc529af367e5) |

## Fingerprints

- Report hash (onchain): `0xa4eaed44deedf97df5acc13798e5a6c7479a0f3779cb9d58879fadb99a9c5812`
- Evidence hash: none
- Verdict transaction: [0x73a39403…](https://testnet.monadexplorer.com/tx/0x73a394034e42f0205679b3845b12d4a5a4095949cd34fccd884a7fb91e8de901)

_Verdict rule: 0 behaviors clean, 1 suspicious, 2+ (or attached ransom-note evidence) malicious._
