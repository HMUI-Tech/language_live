import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
let failed = false;
for (const name of ['deutsch-live', 'italian-live']) {
  const cwd = fileURLToPath(new URL(`../apps/${name}/`, import.meta.url));
  const files = readdirSync(`${cwd}/tests`).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
  console.log(`\n${name}`);
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
