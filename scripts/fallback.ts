#!/usr/bin/env bun
// Fallback to a known-good version without touching your working copy.
//
//   bun scripts/fallback.ts            -> create/refresh ~/Projects/Ransomwhere-Gains-stable at tag v1-cli-stable
//   bun scripts/fallback.ts <tag>      -> same, at another tag
//
// It makes a separate git worktree, copies the gitignored secrets it needs (.env, agent/.wallets.json),
// and installs the agent's dependencies, so the stable demo runs immediately:
//   cd ~/Projects/Ransomwhere-Gains-stable/agent && bun run agent
//
// Run only ONE agent at a time (stable copy or main copy): two agents posting from the same wallet collide.
import { existsSync, copyFileSync, chmodSync } from "node:fs";
import { join, resolve } from "node:path";

const tag = process.argv[2] ?? "v1-cli-stable";
const repo = resolve(import.meta.dir, "..");
const target = resolve(repo, "..", "Ransomwhere-Gains-stable");

function run(cmd: string[], cwd = repo) {
  const p = Bun.spawnSync(cmd, { cwd, stdout: "inherit", stderr: "inherit" });
  if (p.exitCode !== 0) throw new Error(`failed: ${cmd.join(" ")}`);
}

run(["git", "rev-parse", "--verify", `${tag}^{commit}`]);

if (existsSync(target)) {
  console.log(`refreshing ${target} -> ${tag}`);
  run(["git", "checkout", "--detach", tag], target);
} else {
  console.log(`creating ${target} at ${tag}`);
  run(["git", "worktree", "add", "--detach", target, tag]);
}

for (const f of [".env", "agent/.wallets.json"]) {
  const src = join(repo, f);
  if (existsSync(src)) {
    copyFileSync(src, join(target, f));
    chmodSync(join(target, f), 0o600);
    console.log(`copied ${f}`);
  }
}

run(["bun", "install"], join(target, "agent"));
console.log(`\nStable copy ready at ${target} (${tag}).\n  cd ${target}/agent && bun run agent`);
