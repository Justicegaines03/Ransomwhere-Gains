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
| DemoToken | _tbd_ |
| VerdictRegistry | _tbd_ |
| DemoExchange | _tbd_ |
