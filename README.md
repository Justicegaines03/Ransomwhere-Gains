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
