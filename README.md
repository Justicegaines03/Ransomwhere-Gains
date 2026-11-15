# Ransomwhere-Gains

**EDR for blockchain:** behavior-based ransomware verdicts for wallets, published onchain so an exchange can hold a ransom before it is cashed out.

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
| DemoExchange (with rollback) | [`0xbd1e7D8Cd4b8D70D9B1A545a44cf5bE26958BfE1`](https://testnet.monadexplorer.com/address/0xbd1e7D8Cd4b8D70D9B1A545a44cf5bE26958BfE1) |
| DemoExchange (first version, no rollback) | `0xD307DE57992B1b01cd95Ce7E38b15251D881950A` |

Agent / exchange owner (pilot): `0x489D04aE2c40755c3328EeC03f1407B251220632`

## Demo UI (recommended for presenting)

```bash
cd agent && bun run ui     # http://127.0.0.1:4545
```

A wallet EDR console. The **Simulation** bar runs the same commands as the CLI below: **Reset wallets** (fresh wallets only when the current ones were used), **Start agent**, **Clean deposit**, **Victim pays**, **Attacker launders**, **Attempt cash-out**.

| Console view | What it shows |
|---|---|
| KPIs | Wallets monitored, active threats, funds held, time to verdict, funds returned to victims |
| Threats | Every flagged wallet: confidence, classification (ransom wallet, layering hop, consolidation, cash-out), mitigation status; earlier runs on demand |
| Money Trail | The incident as one attack chain rooted at the ransom wallet: coins move per transfer, wallets turn red as verdicts land, DEPOSIT HELD when the exchange contains it |
| Laundering Matrix | AML stages (Evidence, Placement, Layering, Propagation, Integration) x our behaviors, like an ATT&CK matrix: lit cells fired for the selected wallet |
| Timeline | The selected wallet's money movements and its onchain verdict, in order |
| Response | Held deposits with **Roll back to victim** (`DemoExchange.rollback`) and **Release to depositor** for false positives (`DemoExchange.release`), report hash, evidence fingerprint, explorer links |

Run only one agent at a time (UI or CLI). Earlier UI versions are tagged `v3-console` (first console) and `v2-ui-simple`. KPIs count the current trail only.

### Rollback

Endpoint tools can roll a machine back because their agent sits where the files live. A blockchain transfer cannot be reversed, but the equivalent exists at the one place this system has the same control: the exchange that is holding the deposit.

- The attacker’s deposit is held in the exchange contract, so the money has not left reach.
- The threat report for the ransom wallet already records who paid it. That wallet is the victim.
- **Roll back to victim** (console, Response tab) calls `DemoExchange.rollback(depositId, victim)`: the held funds go back to the victim’s wallet in one transaction, and the attacker is credited nothing.

CLI: `bun run src/stage.ts rollback <depositId>`. Tested on testnet: deposit status RolledBack, victim balance back to 1,000 dUSD, exchange balance 0.

Limits, stated plainly: rollback only works for funds that reach a contract which checks the registry and can hold them. Money that goes to a venue that does not check is out of reach. In this pilot the exchange owner decides; a real deployment needs a review and appeal process before funds move.

### Sender views

The console shows the defender’s telemetry. Two more pages show what the people moving the money see:

| Page | Who | What happens |
|---|---|---|
| `/victim` | The ransomware victim | A staged ransom screen (labelled as a simulation). **Connect MetaMask** tops the connected account up to 1,000 dUSD from the demo onramp, then **Send payment** is a real ERC-20 transfer to the ransom wallet, approved in MetaMask. That account becomes the Victim in the console until the next reset. A link pays from a built-in demo wallet if MetaMask is not available. Do not connect the onramp account itself (it is refused). |
| `/exchange` | Everyday user, or the attacker’s cash-out wallet (`?as=cashout`) | A deposit page. The everyday user’s deposit is credited; the attacker’s is put on hold “under compliance review”. |

Suggested flow: `/exchange` (everyday user deposits, credited) → `/victim` (pay with MetaMask) → console (ransom wallet flagged about a second later) → **Attacker launders** → `/exchange?as=cashout` (on hold) → console (Deposit held) → Response tab → **Roll back to victim** → the victim’s wallet (MetaMask) shows the 1,000 dUSD again.

The agent scans from the block where the current wallets were created (`agent/scan-from.json`, written by setup), so it starts instantly; `bun run src/agent.ts --full` rescans from the deploy block.

**Before presenting:**
1. Click **Reset wallets**. A used set of wallets gets replaced (about 1 MON from the funder); the agent restarts on its own.
2. Wait for the agent badge to read **running** and the feed to show `watching dUSD` (a few seconds).
3. Steps 1 and 2 show green ticks. Then run **Clean deposit → Victim pays → Attacker launders → Attempt cash-out** (or use the sender views above).
4. Keep the onramp wallet (`WALLET2`) above about 15 MON (top up at `faucet.monad.xyz`). Below that, Reset still works but sends gas one wallet at a time (about 40 s), because back-to-back MON transfers from an account near Monad’s 10 MON reserve revert.
5. Fallbacks if the testnet is slow: the screenshots in [`docs/screenshots/`](docs/screenshots/README.md), or the stable copy below.

## Fallback

The working CLI demo is tagged `v1-cli-stable`. The simple UI before the console redesign is tagged `v2-ui-simple`. To get a separate, ready-to-run copy without touching this one:

```bash
bun scripts/fallback.ts      # -> ../Ransomwhere-Gains-stable at v1-cli-stable
```

## Run the demo (CLI)

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

Screenshots of the run: [`docs/screenshots/`](docs/screenshots/README.md).
