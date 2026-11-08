import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(resolve(root, "packages/shared/manifest.json"), "utf8"),
);
for (const path of manifest) {
  if (
    !/^(app|components|lib|public|tests|standalone|scripts)\//.test(path) ||
    path.split("/").includes("..")
  )
    throw new Error("Invalid shared source path");
  for (const app of ["deutsch-live", "italian-live"]) {
    const target = resolve(root, "apps", app, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(root, "packages/shared/runtime", path), target);
  }
}
