import "./materialize-shared.mjs";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error("Node.js 22.13 or newer is required.");
  process.exit(1);
}
const checked = spawnSync(
  process.execPath,
  [fileURLToPath(new URL("./check-repository.mjs", import.meta.url))],
  { stdio: "inherit" },
);
if (checked.status !== 0) process.exit(1);
const sharedTest = spawnSync(
  process.execPath,
  ["--test", "tests/shared-boundary.test.mjs"],
  { stdio: "inherit" },
);
if (sharedTest.status !== 0) process.exit(1);
let failed = false;
for (const name of ["deutsch-live", "italian-live"]) {
  const cwd = fileURLToPath(new URL(`../apps/${name}/`, import.meta.url));
  const files = readdirSync(`${cwd}/tests`)
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => `tests/${name}`);
  console.log(`\n${name}`);
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd,
    stdio: "inherit",
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
