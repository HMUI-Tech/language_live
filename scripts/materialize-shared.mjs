import {
  readFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(resolve(root, "packages/shared/manifest.json"), "utf8"),
);
const overwrite = process.argv.includes("--write");
const copies = [],
  hashes = {};
for (const path of manifest) {
  if (
    !/^(app|components|lib|public|tests|standalone|scripts|worker)\//.test(
      path,
    ) ||
    path.split("/").includes("..")
  )
    throw Error("Invalid shared source path");
  const source = resolve(root, "packages/shared/runtime", path),
    bytes = readFileSync(source);
  hashes[path] = createHash("sha256").update(bytes).digest("hex");
  for (const app of ["deutsch-live", "italian-live"]) {
    const target = resolve(root, "apps", app, path);
    if (!overwrite && existsSync(target) && !readFileSync(target).equals(bytes))
      throw Error(
        "Edited shared copy: " +
          target +
          ". Edit the canonical source, then explicitly run npm run prepare:apps -- --write.",
      );
    copies.push({ source, target });
  }
}
for (const { source, target } of copies) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
for (const app of ["deutsch-live", "italian-live"])
  writeFileSync(
    resolve(root, "apps", app, ".shared-source.json"),
    JSON.stringify(hashes, null, 2) + "\n",
  );
