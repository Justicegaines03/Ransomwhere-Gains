# Ransomwhere-Gains

**EDR for money:** behavior-based ransomware verdicts for wallets, published onchain so an exchange can hold a ransom before it is cashed out.

Built at Monad Blitz on Monad testnet. Build plan: [`docs/build-plan.pdf`](docs/build-plan.pdf). Organizer submission steps: [`docs/blitz-submission-process.md`](docs/blitz-submission-process.md).

## Network

| | |
|---|---|
| Network | Monad testnet |
| Chain ID | 10143 |
| RPC | `https://testnet-rpc.monad.xyz` |

## Setup

```bash
git clone --recurse-submodules <this repo>
cp .env.example .env          # fill PRIVATE_KEY with a test-only wallet
cd contracts
forge build && forge test
cast chain-id --rpc-url monad_testnet   # prints 10143
```

`contracts/.env` is a symlink to the root `.env`, so Foundry picks up `MONAD_RPC_URL` and the `monad_testnet` alias in `foundry.toml` works.

## Deploy

```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url monad_testnet --private-key $PRIVATE_KEY --broadcast
```

## Deployed contracts

| Contract | Address |
|---|---|
| DemoToken (dUSD) | [`0x4c5a52AB5bb8589fE576c940fD23F07Bb1D97B5D`](https://testnet.monadexplorer.com/address/0x4c5a52AB5bb8589fE576c940fD23F07Bb1D97B5D) |
| VerdictRegistry | [`0x3525Bd36afB988f8cFeBB95e2C15Af1ee202F8c9`](https://testnet.monadexplorer.com/address/0x3525Bd36afB988f8cFeBB95e2C15Af1ee202F8c9) |
| DemoExchange | [`0xD307DE57992B1b01cd95Ce7E38b15251D881950A`](https://testnet.monadexplorer.com/address/0xD307DE57992B1b01cd95Ce7E38b15251D881950A) |

Agent / exchange owner (pilot): `0x489D04aE2c40755c3328EeC03f1407B251220632`

## Run the demo

Needs [bun](https://bun.sh) and a funded test wallet in `.env` as `WALLET2_PRIVATE_KEY` (the deployer / onramp).

```bash
cd agent
bun install
bun run setup            # demo wallets, gas, agent handover, victim funds, ransom note (add --fresh for new wallets)
bun run agent            # terminal 1: the detection agent — leave it running
bun run clean-deposit    # terminal 2: baseline — a clean wallet deposits and is CREDITED
bun run incident         # victim pays; attacker splits across 4 new wallets, recombines, moves to cash-out
bun run cashout          # the cash-out wallet deposits at the exchange and is HELD
```

Re-run the incident with `bun run setup --fresh` first: the rules need brand-new wallets, just like a real attacker uses.

## How detection works

`agent/src/engine.ts` is plain rules over the token's transfer graph, so every verdict can be explained:

| Behavior | Rule | Bit |
|---|---|---|
| Rapid pass-through | ≥90% of a receipt from a non-service forwarded within 10 min | 1 |
| New-wallet chain | a wallet with no history funded by another wallet with no history | 2 |
| Split and merge | one wallet fans out to ≥3 wallets and ≥2 branches recombine | 4 |
| Many-to-one collection | ≥3 senders pay similar amounts (±10%) into one new wallet | 8 |
| Tainted | received funds from a malicious wallet (propagates downstream) | 16 |
| Ransom-note evidence | an address named in `agent/evidence/*.txt` (fingerprint = keccak256 of the note) | 32 |

**Verdict:** 0 behaviors clean · 1 suspicious · 2+ (or evidence) malicious. Known services (the onramp, the exchange) are allowlisted.
Each flagged wallet gets a report in `agent/reports/` whose keccak256 is stored onchain, so anyone can check the report wasn't changed.
FATF / FinCEN source tags are on each rule; exact indicator wording is still being confirmed.

## Rehearsal result (2026-11-15, Monad testnet)

- Clean deposit **credited**; cash-out deposit of 1,000 dUSD **held** (`DemoExchange.deposits(1)`: verdict 2, status Held).
- Ransom wallet flagged malicious from the ransom note as the ransom arrived; all 4 hops flagged during the split;
  merge + cash-out wallets flagged ~2 s (chain time) after the last hop — before the cash-out was attempted.
- 7 wallets flagged, 0 false positives on the victim, the clean depositor, or the onramp.
