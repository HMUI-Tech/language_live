const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const C = require("../src/core.js");

const T = "2026-10-17";

test("dates: add and diff across month end", () => {
  assert.equal(C.addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(C.daysBetween("2026-10-17", "2026-10-24"), 7);
  assert.equal(C.addDays("2026-03-28", 2), "2026-03-30"); // DST weekend in Germany
});

test("srs: new card graded good is due tomorrow, then 3 days", () => {
  let c = C.newCard(T);
  c = C.review(c, "good", T);
  assert.equal(c.due, "2026-10-18");
  c = C.review(c, "good", "2026-10-18");
  assert.equal(c.ivl, 3);
  assert.equal(c.reps, 2);
});

test("srs: intervals grow with ease, again resets and counts a lapse", () => {
  let c = { due: T, ivl: 10, ease: 2.5, reps: 3, lapses: 0, seen: "2026-09-01" };
  const good = C.review(c, "good", T);
  assert.equal(good.ivl, 25);
  const again = C.review(c, "again", T);
  assert.equal(again.ivl, 0);
  assert.equal(again.due, T);
  assert.equal(again.lapses, 1);
  assert.equal(again.ease, 2.3);
});

test("srs: ease never drops below 1.3 and input is not mutated", () => {
  const c = { due: T, ivl: 5, ease: 1.35, reps: 4, lapses: 0, seen: T };
  const out = C.review(c, "hard", T);
  assert.equal(out.ease, 1.3);
  assert.equal(c.ease, 1.35);
});

test("srs: unknown grade throws", () => {
  assert.throws(() => C.review(C.newCard(T), "meh", T), /unknown grade/);
});

test("answers: articles, umlauts, typos", () => {
  const noun = { de: "Brötchen", art: "das", pos: "noun" };
  assert.equal(C.checkAnswer(noun, "das Brötchen").result, "correct");
  assert.equal(C.checkAnswer(noun, "Das broetchen!").result, "correct");
  assert.equal(C.checkAnswer(noun, "Brötchen").result, "article");
  assert.equal(C.checkAnswer(noun, "der Brötchen").result, "article");
  assert.equal(C.checkAnswer(noun, "das Brötchn").result, "close");
  assert.equal(C.checkAnswer(noun, "das Brot").result, "wrong");
  assert.equal(C.checkAnswer(noun, "   ").result, "wrong");
  const phrase = { de: "Ich hätte gern …", pos: "phrase" };
  assert.equal(C.checkAnswer(phrase, "ich haette gern").result, "correct");
  assert.equal(C.checkAnswer({ de: "Straße", art: "die", pos: "noun" }, "die strasse").result, "correct");
});

test("queue: due first by date, then new items in curriculum order", () => {
  const content = { packs: [{ id: "p", items: [{ id: "p.a" }, { id: "p.b" }, { id: "p.c" }] }] };
  const cards = {
    "p.a": { due: "2026-10-16" },
    "x.z": { due: "2026-10-15" },
    "x.y": { due: "2026-10-20" },
  };
  const q = C.buildQueue(content, cards, T, 1);
  assert.deepEqual(q.due, ["x.z", "p.a"]);
  assert.deepEqual(q.fresh, ["p.b"]);
});

test("targets: 800 words by week 6, 4000 by week 26, linear inside a phase", () => {
  assert.equal(C.targetWords(6), 800);
  assert.equal(C.targetWords(3), 400);
  assert.equal(C.targetWords(12), 1700);
  assert.equal(C.targetWords(26), 4000);
  assert.equal(C.phaseFor(14).level, "B1");
  assert.equal(C.weekOf("2026-10-01", T), 3);
});

test("streak: counts consecutive active days and tolerates today not done yet", () => {
  const log = { "2026-10-14": { reviews: 5 }, "2026-10-15": { reviews: 3 }, "2026-10-16": { turns: 2 } };
  assert.equal(C.streak(log, T), 3);
  assert.equal(C.streak({ ...log, [T]: { reviews: 1 } }, T), 4);
  assert.equal(C.streak({ "2026-10-10": { reviews: 1 } }, T), 0);
});

test("tutor: reply validation and correction cleanup", () => {
  assert.throws(() => C.parseTutorReply({}), /missing/);
  const r = C.parseTutorReply({
    reply: " Hallo! ",
    corrections: [{ wrong: "ich heißt", right: "ich heiße", rule: "ich → -e" }, { wrong: "x" }, null],
  });
  assert.equal(r.reply, "Hallo!");
  assert.equal(r.corrections.length, 1);
  assert.equal(C.customId("Ich heiße!"), "my.ich-heisse");
});

test("content: built A1 content has unique ids and every item is answerable", () => {
  const file = path.join(__dirname, "..", "build", "content.json");
  const content = JSON.parse(fs.readFileSync(file, "utf8"));
  const byId = C.indexItems(content, {});
  assert.ok(Object.keys(byId).length >= 160);
  for (const item of Object.values(byId)) {
    assert.equal(C.checkAnswer(item, C.expectedAnswer(item)).result, "correct", item.id);
  }
});
