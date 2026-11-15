# Threat report — 0xb67bfb2dffb6500fe35a4beffc68218a600cdce7

**Verdict: MALICIOUS** · 5 behavior(s) matched · Monad testnet · 2026-11-15T21:47:10.248Z

## Matched behaviors

- **Rapid pass-through**: Forwarded 400.0% of a 250 dUSD receipt within 1s
  - Source: FATF 2023 Countering Ransomware Financing; FATF 2020 VA Red Flags (rapid movement of funds) — to confirm
  - Evidence: [0xd7e5d1a4…](https://testnet.monadexplorer.com/tx/0xd7e5d1a407f7ca5e6b2195e5651f59e46bf8150f6ff2c3d59d1b17d4f68c05e4), [0x345d7e96…](https://testnet.monadexplorer.com/tx/0x345d7e961a048cd3be489fe3967a140c140e7341f773530554c5aaa266a91f57)
- **New-wallet chain**: No history before receiving from 0x954a…3BD7, which also had no history
  - Source: FATF 2020 VA Red Flags (funds moved through newly created wallets) — to confirm
  - Evidence: [0xd7e5d1a4…](https://testnet.monadexplorer.com/tx/0xd7e5d1a407f7ca5e6b2195e5651f59e46bf8150f6ff2c3d59d1b17d4f68c05e4)
- **Many-to-one collection**: 4 senders paid ~250 dUSD each into this new wallet within 0s
  - Source: FinCEN 2021 Ransomware Advisory (structuring / aggregation patterns) — to confirm
  - Evidence: [0xd7e5d1a4…](https://testnet.monadexplorer.com/tx/0xd7e5d1a407f7ca5e6b2195e5651f59e46bf8150f6ff2c3d59d1b17d4f68c05e4), [0xa5a51896…](https://testnet.monadexplorer.com/tx/0xa5a518962229e30b52cea2983040fcf0dc0f684af0f42a2b462446b64432371d), [0x15036ead…](https://testnet.monadexplorer.com/tx/0x15036eada064355b61f945087060500c8504d39aafac66b5e9b77704d0dbaaa1), [0x8f05bf9a…](https://testnet.monadexplorer.com/tx/0x8f05bf9a8a05acb6654c95c3e68153df4f46ae8dbba241f7deac11e4cc2da5fe)
- **Split and merge**: 0x4eee…9b92 split to 4 wallets; 4 recombined into 0xb67b…dce7
  - Source: FATF 2023 Countering Ransomware Financing (layering via splitting and consolidation) — to confirm
  - Evidence: [0x65592578…](https://testnet.monadexplorer.com/tx/0x65592578495b36392733e027ab554053b5f8615358101b9f5337460a0bae839c), [0x792e1a6f…](https://testnet.monadexplorer.com/tx/0x792e1a6f9841b5d41c4c7c92995c4ca47f3fee42f6eb0297b06f7b485cefe5f1), [0x8c05c9cf…](https://testnet.monadexplorer.com/tx/0x8c05c9cf1d0e0c1b2af291ba6e6bfe75aaed0afb3dade1f271310cf62183ac18), [0xca5cca69…](https://testnet.monadexplorer.com/tx/0xca5cca69e336efae98a936559cbc32b477f9b778f8beae132ed7e7dbd8c3ce8d), [0xd7e5d1a4…](https://testnet.monadexplorer.com/tx/0xd7e5d1a407f7ca5e6b2195e5651f59e46bf8150f6ff2c3d59d1b17d4f68c05e4), [0x8f05bf9a…](https://testnet.monadexplorer.com/tx/0x8f05bf9a8a05acb6654c95c3e68153df4f46ae8dbba241f7deac11e4cc2da5fe) +2 more
- **Received funds from a malicious wallet**: Received 250 dUSD from malicious wallet 0x954a…3BD7
  - Source: Downstream propagation (pilot rule)
  - Evidence: [0xd7e5d1a4…](https://testnet.monadexplorer.com/tx/0xd7e5d1a407f7ca5e6b2195e5651f59e46bf8150f6ff2c3d59d1b17d4f68c05e4)

## Money timeline

| Time (UTC) | Direction | Counterparty | Amount | Tx |
|---|---|---|---|---|
| 21:47:06 | ← in | `0x954a…3BD7` | 250 dUSD | [0xd7e5d1a4…](https://testnet.monadexplorer.com/tx/0xd7e5d1a407f7ca5e6b2195e5651f59e46bf8150f6ff2c3d59d1b17d4f68c05e4) |
| 21:47:06 | ← in | `0x45bA…deBa` | 250 dUSD | [0xa5a51896…](https://testnet.monadexplorer.com/tx/0xa5a518962229e30b52cea2983040fcf0dc0f684af0f42a2b462446b64432371d) |
| 21:47:06 | ← in | `0x1936…2904` | 250 dUSD | [0x15036ead…](https://testnet.monadexplorer.com/tx/0x15036eada064355b61f945087060500c8504d39aafac66b5e9b77704d0dbaaa1) |
| 21:47:06 | ← in | `0x6f7C…D36f` | 250 dUSD | [0x8f05bf9a…](https://testnet.monadexplorer.com/tx/0x8f05bf9a8a05acb6654c95c3e68153df4f46ae8dbba241f7deac11e4cc2da5fe) |
| 21:47:07 | → out | `0x99c3…8071` | 1,000 dUSD | [0x345d7e96…](https://testnet.monadexplorer.com/tx/0x345d7e961a048cd3be489fe3967a140c140e7341f773530554c5aaa266a91f57) |

## Fingerprints

- Report hash (onchain): `0x9dcf518b4271d6f45965b0860089bfd8147bf84d863fe4ababd1ffaace3ae130`
- Evidence hash: none
- Verdict transaction: [0xa6435c98…](https://testnet.monadexplorer.com/tx/0xa6435c9828418a9930241047e21345fcc334987fef38023fd428552e6f238096)

_Verdict rule: 0 behaviors clean, 1 suspicious, 2+ (or attached ransom-note evidence) malicious._
