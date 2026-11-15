export {};
// Copies ABIs from Foundry's build output into agent/src/abi so the agent runs without forge.
// Run after `forge build` whenever a contract changes: bun run abi
const names = ["VerdictRegistry", "DemoExchange", "DemoToken"];
for (const n of names) {
  const artifact = await Bun.file(`../contracts/out/${n}.sol/${n}.json`).json();
  await Bun.write(`src/abi/${n}.json`, JSON.stringify(artifact.abi, null, 2) + "\n");
  console.log(`exported ${n}`);
}
