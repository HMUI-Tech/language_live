import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { verifyShared } from "../packages/shared/runtime/scripts/verify-shared.mjs";
test("tests and standalone builds reject a hand-edited materialized copy without overwriting it", () => {
  const root = mkdtempSync(resolve(tmpdir(), "shared-boundary-"));
  try {
    mkdirSync(resolve(root, "scripts"), { recursive: true });
    mkdirSync(resolve(root, "packages/shared/runtime/lib"), {
      recursive: true,
    });
    copyFileSync(
      new URL("../scripts/materialize-shared.mjs", import.meta.url),
      resolve(root, "scripts/materialize-shared.mjs"),
    );
    writeFileSync(
      resolve(root, "packages/shared/manifest.json"),
      JSON.stringify(["lib/example.mjs"]),
    );
    writeFileSync(
      resolve(root, "packages/shared/runtime/lib/example.mjs"),
      "export const value=1;\n",
    );
    const run = (...args) =>
      spawnSync(
        process.execPath,
        [resolve(root, "scripts/materialize-shared.mjs"), ...args],
        { encoding: "utf8" },
      );
    assert.equal(run().status, 0);
    const app = resolve(root, "apps/deutsch-live");
    verifyShared(app);
    const path = resolve(app, "lib/example.mjs");
    writeFileSync(path, "BROKEN COPY");
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /Edited shared copy/);
    assert.equal(readFileSync(path, "utf8"), "BROKEN COPY");
    assert.throws(() => verifyShared(app), /Edited shared copy/);
    assert.equal(run("--write").status, 0);
    verifyShared(app);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
