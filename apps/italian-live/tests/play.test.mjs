import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const ctx = {};
vm.runInNewContext(fs.readFileSync("public/play-core.js", "utf8"), ctx);
const P = ctx.DLPlayCore,
  day = "2026-11-05";
test("Italian game pool contains 36 unique nouns and correctly joined singular articles", () => {
  assert.equal(P.WORDS.length, 36);
  assert.equal(new Set(P.WORDS.map((w) => w.id)).size, 36);
  assert.equal(new Set(P.WORDS.map((w) => w.en)).size, 36);
  for (const w of P.WORDS) assert(["il", "lo", "la", "l'"].includes(w.article));
  assert.equal(P.phrase(P.WORDS.find((w) => w.id === "albero")), "l'albero");
  assert.equal(P.phrase(P.WORDS.find((w) => w.id === "zaino")), "lo zaino");
  assert.equal(P.phrase(P.WORDS.find((w) => w.id === "casa")), "la casa");
});
test("badges need distinct practice and daily quests require recall as well as games", () => {
  let p = P.empty();
  p = P.record(p, day, "match", "cane");
  assert(p.earned.first);
  p = P.record(p, day, "match", "cane");
  assert.equal(p.matches.length, 1);
  for (const w of P.WORDS.slice(0, 12)) {
    p = P.record(p, day, "match", w.id);
    p = P.record(p, day, "articles", w.id);
  }
  assert(p.earned.words && p.earned.articles);
  assert(!p.earned.quest);
  for (let i = 0; i < 5; i++) p = P.recordReview(p, day, "word." + i, true);
  assert(p.earned.quest);
  assert.equal(P.quests(p, "2026-11-06")[0].value, 0);
});
test("unknown imported words are discarded and all badge rewards are real Italian PDFs", () => {
  assert.equal(
    P.sanitize({ matches: ["hund", "cane", "cane"] }, day).matches.join(),
    "cane",
  );
  for (const b of P.BADGES) {
    const file = "public/rewards/" + b.resource;
    assert(fs.existsSync(file));
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString(), "%PDF");
  }
});
