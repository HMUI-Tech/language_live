import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("privacy copy matches the actual language and operator country", () => {
  const p = fs.readFileSync("public/privacy.html", "utf8").replace(/\s+/g, " ");
  assert(!p.includes("Italianoland"));
  assert(p.includes("deutsche Systemstimmen"));
});
