# Ransomwhere-Gains — working rules

- **Keep `README.md` current.** Any change that affects how to run, demo, deploy, or understand the project
  (commands, UI, addresses, fallback, results) updates the README in the same commit.
- **Commit before risky steps** (anything that spends testnet MON or writes to the registry), with a message that says what it is.
- **Push only to `origin`** (Justicegaines03/Ransomwhere-Gains). `upstream` (organizers' repo) has pushes disabled on purpose.
- **Fallback point:** tag `v1-cli-stable`; `bun scripts/fallback.ts` makes a separate runnable copy. Never rewrite tagged history.
- **One agent at a time** (UI or CLI): two agents posting from the same wallet collide.
- Keys live only in `.env` and `agent/.wallets*.json` (gitignored). Scan history before pushing anything that touched them.
