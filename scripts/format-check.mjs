import "./materialize-shared.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const prettier = root + "node_modules/prettier/bin/prettier.cjs";
for (const name of ["deutsch-live", "italian-live"]) {
  const result = spawnSync(
    process.execPath,
    [
      prettier,
      "--check",
      "app/**/*.{ts,tsx,css}",
      "lib/*.{mjs,ts,mts}",
      "public/*.{js,css,html}",
      "scripts/**/*.mjs",
      "scripts/**/*.ts",
      "standalone/src/*.js",
      "tests/*.mjs",
      "worker/*.ts",
      "db/schema.ts",
      "vite.config.ts",
      "postcss.config.mjs",
      "eslint.config.mjs",
    ],
    { cwd: root + "apps/" + name, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
