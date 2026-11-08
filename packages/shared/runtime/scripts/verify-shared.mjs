import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
export function verifyShared(root) {
  const path = resolve(root, ".shared-source.json");
  if (!existsSync(path))
    throw Error(
      "Shared source manifest missing. Run the root prepare:apps command.",
    );
  const hashes = JSON.parse(readFileSync(path, "utf8"));
  for (const [name, hash] of Object.entries(hashes)) {
    const bytes = readFileSync(resolve(root, name));
    if (createHash("sha256").update(bytes).digest("hex") !== hash)
      throw Error(
        "Edited shared copy: " +
          name +
          ". Edit packages/shared/runtime and explicitly run prepare:apps -- --write.",
      );
  }
}
