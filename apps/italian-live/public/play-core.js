/* Original Italian Live game content and deterministic progress rules. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DLPlayCore = api;
})(globalThis, function () {
  "use strict";
  const WORDS = [
    ["cane", "il", "cane", "dog", "🐕"],
    ["gatto", "il", "gatto", "cat", "🐈"],
    ["casa", "la", "casa", "house", "🏠"],
    ["albero", "l'", "albero", "tree", "🌳"],
    ["fiore", "il", "fiore", "flower", "🌼"],
    ["libro", "il", "libro", "book", "📖"],
    ["mela", "la", "mela", "apple", "🍎"],
    ["banana", "la", "banana", "banana", "🍌"],
    ["pane", "il", "pane", "bread", "🍞"],
    ["tavolo", "il", "tavolo", "table", "🪑"],
    ["lampada", "la", "lampada", "lamp", "💡"],
    ["letto", "il", "letto", "bed", "🛏️"],
    ["sedia", "la", "sedia", "chair", "🪑"],
    ["porta", "la", "porta", "door", "🚪"],
    ["finestra", "la", "finestra", "window", "🪟"],
    ["pallone", "il", "pallone", "ball", "⚽"],
    ["orologio", "l'", "orologio", "clock", "🕒"],
    ["bicicletta", "la", "bicicletta", "bicycle", "🚲"],
    ["pesce", "il", "pesce", "fish", "🐟"],
    ["sole", "il", "sole", "sun", "☀️"],
    ["auto", "l'", "auto", "car", "🚗"],
    ["uccello", "l'", "uccello", "bird", "🐦"],
    ["nuvola", "la", "nuvola", "cloud", "☁️"],
    ["bambino", "il", "bambino", "child", "🧒"],
    ["treno", "il", "treno", "train", "🚆"],
    ["borsa", "la", "borsa", "bag", "👜"],
    ["uovo", "l'", "uovo", "egg", "🥚"],
    ["luna", "la", "luna", "moon", "🌙"],
    ["scuola", "la", "scuola", "school", "🏫"],
    ["acqua", "l'", "acqua", "water", "💧"],
    ["stella", "la", "stella", "star", "⭐"],
    ["strada", "la", "strada", "street", "🛣️"],
    ["telefono", "il", "telefono", "telephone", "☎️"],
    ["giardino", "il", "giardino", "garden", "🌱"],
    ["bottiglia", "la", "bottiglia", "bottle", "🍶"],
    ["zaino", "lo", "zaino", "backpack", "🎒"],
  ].map(([id, article, word, en, emoji]) => ({ id, article, word, en, emoji }));
  const phrase = (w) =>
    w.article + (w.article.endsWith("'") ? "" : " ") + w.word;
  const BADGES = [
    {
      id: "first",
      title: "Primi passi",
      en: "First Steps",
      emoji: "🌱",
      description: "Get your first game answer right.",
      resource: "word-cards.pdf",
      reward: "Everyday word cards",
    },
    {
      id: "words",
      title: "Esploratore di parole",
      en: "Word Explorer",
      emoji: "🧭",
      description: "Match 12 different words.",
      resource: "word-missions.pdf",
      reward: "Word missions activity pack",
    },
    {
      id: "articles",
      title: "Detective degli articoli",
      en: "Article Detective",
      emoji: "🔎",
      description: "Choose the article for 12 different words.",
      resource: "article-workbook.pdf",
      reward: "Article workbook + answers",
    },
    {
      id: "quest",
      title: "Eroe del giorno",
      en: "Daily Quest Hero",
      emoji: "🏅",
      description: "Finish all three daily quests on one day.",
      resource: "dialogue-cards.pdf",
      reward: "Family & friend dialogue cards",
    },
    {
      id: "days",
      title: "Sempre curioso",
      en: "Always Curious",
      emoji: "🌟",
      description:
        "Practise on three different days. They need not be consecutive.",
      resource: "mini-story.pdf",
      reward: "Illustration-ready mini-story + activities",
    },
  ];
  const ids = new Set(WORDS.map((w) => w.id));
  const validDay = (d) =>
    typeof d === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    Number.isFinite(Date.parse(d + "T12:00:00Z")) &&
    new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d;
  const reviews = (value) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id) => typeof id === "string" && /^[a-z0-9._-]{1,80}$/i.test(id),
            ),
          ),
        ].slice(0, 5)
      : [];
  const unique = (value) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter((id) => typeof id === "string" && ids.has(id)),
          ),
        ]
      : [];
  function empty() {
    return { v: 1, matches: [], articles: [], days: {}, earned: {} };
  }
  function sanitize(raw, today) {
    const p = empty();
    if (!raw || typeof raw !== "object") return p;
    p.matches = unique(raw.matches);
    p.articles = unique(raw.articles);
    const cutoff = new Date(Date.parse(today + "T12:00:00Z") - 89 * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const [day, value] of Object.entries(raw.days || {})) {
      if (
        validDay(day) &&
        day <= today &&
        day >= cutoff &&
        value &&
        typeof value === "object"
      )
        p.days[day] = {
          matches: unique(value.matches),
          articles: unique(value.articles),
          reviewIds: reviews(value.reviewIds),
        };
    }
    for (const b of BADGES) {
      const date = raw.earned?.[b.id];
      if (validDay(date) && date <= today) p.earned[b.id] = date;
    }
    return p;
  }
  function quests(progress, today, log = {}) {
    const p = sanitize(progress, today),
      d = p.days[today] || { matches: [], articles: [] };
    const reviewed = (d.reviewIds || []).length,
      dialogs = Math.max(0, Number(log[today]?.dialogs) || 0);
    return [
      {
        id: "match",
        title: "Match three words",
        value: Math.min(3, d.matches.length),
        target: 3,
        mode: "match",
      },
      {
        id: "articles",
        title: "Find three articles",
        value: Math.min(3, d.articles.length),
        target: 3,
        mode: "articles",
      },
      {
        id: "lesson",
        title: "Recall five different cards or finish one dialogue",
        value: dialogs > 0 ? 5 : Math.min(5, reviewed),
        target: 5,
        mode: "lesson",
      },
    ];
  }
  function award(raw, today, log = {}) {
    const p = sanitize(raw, today);
    const earn = (id) => {
      if (!p.earned[id]) p.earned[id] = today;
    };
    if (p.matches.length + p.articles.length > 0) earn("first");
    if (p.matches.length >= 12) earn("words");
    if (p.articles.length >= 12) earn("articles");
    if (quests(p, today, log).every((q) => q.value >= q.target)) earn("quest");
    const active = new Set(
      Object.entries(p.days)
        .filter(([, d]) => d.matches.length + d.articles.length > 0)
        .map(([d]) => d),
    );
    for (const [day, d] of Object.entries(log || {}))
      if (
        validDay(day) &&
        day <= today &&
        (Number(d.reviews) || 0) + (Number(d.dialogs) || 0) > 0
      )
        active.add(day);
    if (active.size >= 3) earn("days");
    return p;
  }
  function record(raw, today, mode, id, log = {}) {
    const p = sanitize(raw, today);
    if (!["match", "articles"].includes(mode) || !ids.has(id))
      return award(p, today, log);
    const key = mode === "match" ? "matches" : "articles";
    if (!p[key].includes(id)) p[key].push(id);
    const d = p.days[today] || (p.days[today] = { matches: [], articles: [] });
    if (!d[key].includes(id)) d[key].push(id);
    return award(p, today, log);
  }
  function recordReview(raw, today, id, correct, log = {}) {
    const p = sanitize(raw, today);
    if (correct && typeof id === "string" && /^[a-z0-9._-]{1,80}$/i.test(id)) {
      const d =
        p.days[today] ||
        (p.days[today] = { matches: [], articles: [], reviewIds: [] });
      d.reviewIds = d.reviewIds || [];
      if (d.reviewIds.length < 5 && !d.reviewIds.includes(id))
        d.reviewIds.push(id);
    }
    return award(p, today, log);
  }
  function shuffled(list, seed) {
    let n = 2166136261;
    for (const c of String(seed))
      n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) {
      n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
      const j = n % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function round(seed) {
    return shuffled(WORDS, seed).slice(0, 6);
  }
  return {
    WORDS,
    phrase,
    BADGES,
    empty,
    sanitize,
    quests,
    award,
    record,
    recordReview,
    shuffled,
    round,
  };
});
