/* Deutsch Live core: pure functions only (no DOM, no storage, no network).
 * Loaded in the browser as window.DLCore and in Node tests via require().
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DLCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------- dates (local calendar days as YYYY-MM-DD) ----------
  function todayStr(date) {
    const d = date || new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function parseDay(str) {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d, 12); // noon avoids DST edges
  }
  function addDays(str, n) {
    const d = parseDay(str);
    d.setDate(d.getDate() + n);
    return todayStr(d);
  }
  function daysBetween(a, b) {
    return Math.round((parseDay(b) - parseDay(a)) / 86400000);
  }

  // ---------- spaced repetition (SM-2 variant) ----------
  const GRADES = { again: 0, hard: 1, good: 2, easy: 3 };
  const MIN_EASE = 1.3;

  function newCard(today) {
    return { due: today, ivl: 0, ease: 2.5, reps: 0, lapses: 0, seen: today };
  }

  /** Returns a NEW card object; the input is never mutated. */
  function review(card, grade, today) {
    if (!(grade in GRADES)) throw new Error(`unknown grade: ${grade}`);
    const c = { ...card };
    if (grade === "again") {
      if (c.reps > 0) c.lapses += 1;
      c.ease = Math.max(MIN_EASE, c.ease - 0.2);
      c.ivl = 0;
      c.due = today; // comes back in this session
      c.reps = 0;
      return c;
    }
    let ivl;
    if (c.reps === 0) {
      ivl = { hard: 1, good: 1, easy: 4 }[grade];
    } else if (c.reps === 1) {
      ivl = { hard: 2, good: 3, easy: 6 }[grade];
    } else {
      const base = Math.max(1, c.ivl);
      ivl = { hard: base * 1.2, good: base * c.ease, easy: base * c.ease * 1.3 }[grade];
    }
    if (grade === "hard") c.ease = Math.max(MIN_EASE, c.ease - 0.15);
    if (grade === "easy") c.ease = c.ease + 0.15;
    c.ivl = Math.max(1, Math.round(ivl));
    c.due = addDays(today, c.ivl);
    c.reps += 1;
    return c;
  }

  // ---------- answer checking ----------
  function normalize(s) {
    return String(s)
      .toLowerCase()
      .replace(/…|\.\.\./g, " ")
      .replace(/[.,!?;:"'()–—-]/g, " ")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/\s+/g, " ")
      .trim();
  }

  function expectedAnswer(item) {
    return item.pos === "noun" && item.art ? `${item.art} ${item.de}` : item.de;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }

  /** result: correct | close (one typo) | article (right word, wrong/missing article) | wrong */
  function checkAnswer(item, input) {
    const expected = expectedAnswer(item);
    const got = normalize(input);
    const want = normalize(expected);
    if (!got) return { result: "wrong", expected };
    if (got === want) return { result: "correct", expected };
    if (item.pos === "noun") {
      const bare = got.replace(/^(der|die|das)\s+/, "");
      if (bare === normalize(item.de)) return { result: "article", expected };
    }
    const allowed = want.length >= 6 ? 1 : 0;
    if (allowed && levenshtein(got, want) <= allowed) return { result: "close", expected };
    return { result: "wrong", expected };
  }

  /** A failed recall must be relearned; a typo cannot be marked Easy. */
  function gradeForAnswer(grade, result) {
    if (!(grade in GRADES)) throw new Error('Unknown recall grade.');
    if (result === 'wrong' || result === 'article') return 'again';
    if (result === 'close') return grade === 'again' ? 'again' : 'hard';
    if (result === 'correct') return grade;
    throw new Error('Check the answer before grading.');
  }

  /** Bound each sitting, prioritising review when a backlog builds up. */
  function sessionPlan(queue, minutes) {
    if (!queue || !Array.isArray(queue.due) || !Array.isArray(queue.fresh)) throw new Error('Invalid learning queue.');
    const duration = Number.isFinite(minutes) ? Math.max(15, Math.min(240, minutes)) : 60;
    const reviewLimit = Math.max(10, Math.min(60, Math.round(duration / 2)));
    const newLimit = Math.max(5, Math.min(20, Math.floor(duration / 6)));
    const pausedNew = queue.due.length > reviewLimit * 2;
    return {due:queue.due.slice(0,reviewLimit), fresh:pausedNew?[]:queue.fresh.slice(0,newLimit), remainingReviews:Math.max(0,queue.due.length-reviewLimit), pausedNew};
  }

  const SUGGESTED_GRADE = { correct: "good", close: "hard", article: "again", wrong: "again" };

  // ---------- content helpers ----------
  function indexItems(content, customItems) {
    const byId = {};
    for (const pack of content.packs) for (const item of pack.items) byId[item.id] = { ...item, pack: pack.id };
    for (const [id, item] of Object.entries(customItems || {})) byId[id] = { ...item, id, pack: "my" };
    return byId;
  }

  /** Due cards (oldest first) and up to `newLimit` unseen items in curriculum order. */
  function buildQueue(content, cards, today, newLimit) {
    const due = Object.entries(cards)
      .filter(([, c]) => c.due <= today)
      .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : a[0] < b[0] ? -1 : 1))
      .map(([id]) => id);
    const fresh = [];
    if (newLimit > 0) {
      outer: for (const pack of content.packs) {
        for (const item of pack.items) {
          if (!(item.id in cards)) {
            fresh.push(item.id);
            if (fresh.length >= newLimit) break outer;
          }
        }
      }
    }
    return { due, fresh };
  }

  function newIntroducedToday(cards, today) {
    return Object.values(cards).filter((c) => c.seen === today).length;
  }

  // ---------- curriculum targets ----------
  const PHASES = [
    { level: "A1", from: 1, to: 6, words: 800 },
    { level: "A2", from: 7, to: 12, words: 1700 },
    { level: "B1", from: 13, to: 19, words: 2900 },
    { level: "B2", from: 20, to: 26, words: 4000 },
  ];

  function weekOf(startDay, today) {
    return Math.min(26, Math.max(1, Math.floor(daysBetween(startDay, today) / 7) + 1));
  }
  function phaseFor(week) {
    return PHASES.find((p) => week >= p.from && week <= p.to) || PHASES[PHASES.length - 1];
  }
  /** Words the learner should know by the end of `week` (linear inside each phase). */
  function targetWords(week) {
    let prev = { to: 0, words: 0 };
    for (const p of PHASES) {
      if (week <= p.to) {
        const span = p.to - prev.to;
        return Math.round(prev.words + ((week - prev.to) / span) * (p.words - prev.words));
      }
      prev = p;
    }
    return 4000;
  }

  // ---------- progress ----------
  function streak(log, today) {
    let n = 0;
    let day = today;
    if (!activeDay(log[day])) day = addDays(day, -1); // today not done yet keeps yesterday's streak
    while (activeDay(log[day])) {
      n += 1;
      day = addDays(day, -1);
    }
    return n;
  }
  function activeDay(entry) {
    return !!entry && (entry.reviews || 0) + (entry.turns || 0) > 0;
  }

  function stats(cards, log, today) {
    const list = Object.values(cards);
    const learned = list.filter((c) => c.reps > 0 || c.lapses > 0).length;
    const mature = list.filter((c) => c.ivl >= 21).length;
    const due = list.filter((c) => c.due <= today).length;
    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i);
      last14.push({ day: d, reviews: (log[d] && log[d].reviews) || 0 });
    }
    return { learned, mature, due, seen: list.length, streak: streak(log, today), last14 };
  }

  // ---------- AI tutor prompts ----------
  function tutorRules(scene, level) {
    return [
      `You are a friendly German conversation partner for an adult learner at CEFR level ${level}.`,
      `Role-play this everyday situation and stay in role: ${scene}`,
      `Speak only simple, natural spoken German at level ${level}: 1 or 2 short sentences per turn, then hand the turn back with a question.`,
      "After each learner message, check their German. Ignore missing capitals and punctuation; correct grammar, word order, articles, endings and wrong words.",
      'Reply with only JSON: {"reply": string (your German line), "reply_en": string (English translation),',
      '"corrections": [{"wrong": string, "right": string, "rule": string (one short English sentence)}]}.',
      "Use an empty corrections array when the learner's German is correct. Never correct more than 3 things per turn.",
      "Start the role-play now with your first line, with an empty corrections array.",
    ].join("\n");
  }

  function writingPrompt(task, level, text) {
    return [
      `Correct this German text by an adult learner at CEFR level ${level}. Task: ${task}`,
      "Reply with only JSON:",
      '{"corrected": string (the full text, corrected, keeping the learner\'s meaning),',
      '"better": string (the same text rewritten one level higher, still natural),',
      '"corrections": [{"wrong": string, "right": string, "rule": string (one short English sentence)}],',
      '"score": integer 1-5 (5 = no mistakes)}. List at most 6 corrections, most important first.',
      "",
      "Text:",
      text,
    ].join("\n");
  }

  function cleanCorrections(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((c) => c && typeof c.wrong === "string" && typeof c.right === "string" && c.right.trim())
      .slice(0, 6)
      .map((c) => ({ wrong: c.wrong.trim(), right: c.right.trim(), rule: String(c.rule || "").trim() }));
  }

  function parseTutorReply(value) {
    if (!value || typeof value.reply !== "string" || !value.reply.trim()) {
      throw new Error("tutor reply is missing the 'reply' text");
    }
    return {
      reply: value.reply.trim(),
      reply_en: typeof value.reply_en === "string" ? value.reply_en.trim() : "",
      corrections: cleanCorrections(value.corrections),
    };
  }

  /** A correction becomes a custom card: the learner types the right form from the rule. */
  function correctionToItem(corr) {
    return { de: corr.right, pos: "phrase", en: corr.rule || `Not: ${corr.wrong}`, ex: corr.right, ex_en: `Instead of: ${corr.wrong}` };
  }

  function customId(text) {
    const slug = normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
    return `my.${slug || "x"}`;
  }

  return {
    todayStr, addDays, daysBetween,
    GRADES, newCard, review, gradeForAnswer, sessionPlan,
    normalize, expectedAnswer, levenshtein, checkAnswer, SUGGESTED_GRADE,
    indexItems, buildQueue, newIntroducedToday,
    PHASES, weekOf, phaseFor, targetWords,
    streak, stats,
    tutorRules, writingPrompt, parseTutorReply, cleanCorrections, correctionToItem, customId,
  };
});
