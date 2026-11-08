/* Closed learning rewards. Shared deterministic rules; saved wallets are owned by the server. */
(function (root) {
  const CATALOG = [
    {
      id: "hat",
      title: "Explorer hat",
      icon: "🎩",
      price: 30,
      kind: "hat",
      description: "A permanent explorer hat for your learning companion.",
    },
    {
      id: "glasses",
      title: "Curious glasses",
      icon: "👓",
      price: 30,
      kind: "glasses",
      description: "Glasses for your companion. Wear them whenever you like.",
    },
    {
      id: "scarf",
      title: "Adventure scarf",
      icon: "🧣",
      price: 60,
      kind: "scarf",
      description: "A bright scarf for your companion.",
    },
    {
      id: "garden",
      title: "Garden background",
      icon: "🌳",
      price: 50,
      kind: "room",
      description: "A peaceful garden for your companion.",
    },
    {
      id: "reading-room",
      title: "Cosy reading room",
      icon: "📚",
      price: 100,
      kind: "room",
      description: "A reading corner with books and a warm lamp.",
    },
    {
      id: "ocean",
      title: "Ocean theme",
      icon: "🌊",
      price: 75,
      kind: "theme",
      description: "A blue colour theme for the app and reading background.",
    },
    {
      id: "plum",
      title: "Berry theme",
      icon: "🫐",
      price: 75,
      kind: "theme",
      description: "A purple colour theme for the app and reading background.",
    },
    {
      id: "bonus",
      title: "Three bonus stories",
      icon: "📖",
      price: 100,
      kind: "content",
      description:
        "Three new short mysteries with questions, explanations and vocabulary help.",
    },
    {
      id: "branch",
      title: "Choose your adventure",
      icon: "🧭",
      price: 50,
      kind: "content",
      description:
        "Explore a park story with different paths and endings. Replay every choice.",
    },
    {
      id: "print",
      title: "Printable activity studio",
      icon: "🖨️",
      price: 150,
      kind: "content",
      description:
        "Unlimited word-search, matching and article worksheets, with answer sheets. Print or save as PDF.",
    },
    {
      id: "personal",
      title: "My practice workshop",
      icon: "🛠️",
      price: 200,
      kind: "content",
      description:
        "Unlimited practice packs based on words you missed. If none are recorded, discover unpractised words.",
    },
    {
      id: "journey",
      title: "Seven-stage travel adventure",
      icon: "🗺️",
      price: 250,
      kind: "content",
      description:
        "Seven connected travel chapters with questions. Play at your own pace; no daily deadlines.",
    },
  ];
  const AVATARS = ["🦊", "🐼", "🐸", "🦁", "🐨", "🐧", "🐱", "🐻"];
  const SLOTS = [
    "hat",
    "glasses",
    "scarf",
    "room",
    "theme",
    "outfit",
    "vehicle",
    "property",
    "club",
  ];
  CATALOG.push(
    ...[
      ["casual", "Weekend outfit", "👕", 60, "outfit"],
      ["sport", "Sports outfit", "🎽", 120, "outfit"],
      ["suit", "City suit", "👔", 250, "outfit"],
      ["royal", "Royal outfit", "👑", 600, "outfit"],
      ["bike", "City bicycle", "🚲", 150, "vehicle"],
      ["compact", "Compact car", "🚗", 450, "vehicle"],
      ["electric", "Electric car", "🚙", 900, "vehicle"],
      ["sports-car", "Sports car", "🏎️", 2000, "vehicle"],
      ["supercar", "Supercar", "🏁", 5000, "vehicle"],
      ["studio", "First apartment", "🏢", 400, "property"],
      ["cottage", "Garden cottage", "🏡", 900, "property"],
      ["villa", "Coastal villa", "🏖️", 2200, "property"],
      ["mansion", "Grand mansion", "🏰", 5000, "property"],
      ["hotel", "Boutique hotel", "🏨", 9000, "property"],
      ["resort", "Island resort", "🏝️", 15000, "property"],
      ["cafe-club", "Language café", "☕", 100, "club"],
      ["travel-club", "Travel explorers", "🧳", 450, "club"],
      ["book-club", "Book society", "📚", 900, "club"],
      ["world-club", "World citizens", "🌍", 2200, "club"],
    ].map(([id, title, icon, price, kind]) => ({
      id,
      title,
      icon,
      price,
      kind,
      description:
        kind === "club"
          ? "Lifetime club membership with a shared phrase board."
          : kind === "outfit"
            ? "A permanent outfit for your avatar."
            : "A collectible for your personal learning world. No passive income or upkeep.",
    })),
  );
  const KIDS_CATALOG = CATALOG.filter(
    (x) => !["property", "vehicle", "club"].includes(x.kind),
  ).map((x) => ({ ...x }));
  const prices = {
    hat: 40,
    glasses: 40,
    scarf: 80,
    garden: 80,
    "reading-room": 160,
    ocean: 80,
    plum: 80,
    casual: 80,
    sport: 160,
    suit: 320,
    royal: 640,
    bike: 160,
    compact: 320,
    electric: 640,
    "sports-car": 1280,
    supercar: 2560,
    studio: 640,
    cottage: 1280,
    villa: 2560,
    mansion: 5120,
    hotel: 10240,
    resort: 20480,
    "cafe-club": 160,
    "travel-club": 640,
    "book-club": 2560,
    "world-club": 10240,
  };
  for (const item of CATALOG) if (prices[item.id]) item.price = prices[item.id];
  CATALOG.push(
    {
      id: "friends-pass",
      title: "Friends & chat pass",
      icon: "💬",
      price: 160,
      kind: "social",
      description:
        "Unlock friend invitations and text chat after mutual acceptance. Same age-band contacts only.",
    },
    {
      id: "private-club-pass",
      title: "Private clubhouse charter",
      icon: "🔐",
      price: 2560,
      kind: "social",
      description:
        "Create one private invitation-only club. Members need their own Friends & chat pass.",
    },
  );
  const catalog = (kids) => (kids ? KIDS_CATALOG : CATALOG);
  const STAR_THRESHOLDS = [0, 100, 240, 420, 660, 980, 1400, 1940, 2620, 3460];
  const STAGES = ["Beginner", "Intermediate", "Advanced"];
  function rank(wallet) {
    const points = Math.max(0, Math.min(3460, wallet.starPoints || 0));
    let completed = 0;
    for (let i = 1; i < STAR_THRESHOLDS.length; i++)
      if (points >= STAR_THRESHOLDS[i]) completed = i;
    const stageIndex = Math.min(2, Math.floor(completed / 3));
    const percents = STAR_THRESHOLDS.slice(1).map((end, i) =>
      Math.max(
        0,
        Math.min(
          100,
          (100 * (points - STAR_THRESHOLDS[i])) / (end - STAR_THRESHOLDS[i]),
        ),
      ),
    );
    return {
      level: STAGES[stageIndex],
      stageIndex,
      completed,
      starsInLevel: completed - stageIndex * 3,
      percent: completed === 9 ? 100 : percents[completed],
      percents,
    };
  }
  function changePoints(w, delta, day, kids = false) {
    if (w.pointDay !== day) {
      w.pointDay = day;
      w.pointEarned = 0;
      w.pointLost = 0;
    }
    if (delta > 0) {
      delta = Math.min(delta, 150 - w.pointEarned);
      w.pointEarned += delta;
    } else {
      if (kids) return 0;
      delta = -Math.min(-delta, 10 - w.pointLost, w.starPoints);
      w.pointLost -= delta;
    }
    const before = w.starPoints;
    w.starPoints = Math.max(0, Math.min(3460, w.starPoints + delta));
    w.stars = rank(w).completed;
    return w.starPoints - before;
  }
  function sacrifice(w, count) {
    const before = rank(w),
      completed = before.completed;
    if (!Number.isSafeInteger(count) || count < 1 || count > completed)
      throw Error(
        "Not enough completed stars. Partially filled stars cannot be spent.",
      );
    const target = completed - count,
      fraction = completed === 9 ? 0 : before.percent / 100;
    w.starPoints =
      STAR_THRESHOLDS[target] +
      Math.floor(
        fraction * (STAR_THRESHOLDS[target + 1] - STAR_THRESHOLDS[target]),
      );
    w.stars = rank(w).completed;
    w.starsSpent = (w.starsSpent || 0) + count;
    return w;
  }
  function priceInStars(price) {
    return Math.min(9, Math.max(1, Math.ceil(Math.log2(price / 40)) + 1));
  }
  for (const item of [...CATALOG, ...KIDS_CATALOG])
    item.starPrice = priceInStars(item.price);
  const empty = () => ({
    v: 3,
    starPoints: 0,
    starsSpent: 0,
    pointDay: "",
    pointEarned: 0,
    pointLost: 0,
    ageBand: null,
    coinDay: "",
    dayCoins: 0,
    earned: 0,
    spent: 0,
    owned: [],
    wear: {},
    reading: {},
    match: [],
    articles: [],
    recall: [],
    reviews: [],
    weak: {},
    lastDay: "",
    history: [],
    stars: 0,
    avatar: "🦊",
    daily: { day: "", ids: [] },
    perfect: [],
    failed: [],
    completedDays: [],
    milestones: [],
  });
  function normalize(raw) {
    const w = empty();
    if (!raw || typeof raw !== "object") return w;
    w.ageBand = ["16-17", "18+"].includes(raw.ageBand) ? raw.ageBand : null;
    w.coinDay = typeof raw.coinDay === "string" ? raw.coinDay : "";
    w.dayCoins = Number.isSafeInteger(raw.dayCoins)
      ? Math.max(0, Math.min(20, raw.dayCoins))
      : 0;
    w.earned =
      Number.isSafeInteger(raw.earned) && raw.earned >= 0 ? raw.earned : 0;
    w.spent =
      Number.isSafeInteger(raw.spent) && raw.spent >= 0 && raw.spent <= w.earned
        ? raw.spent
        : 0;
    w.owned = [
      ...new Set(
        (Array.isArray(raw.owned) ? raw.owned : []).filter((id) =>
          CATALOG.some((x) => x.id === id),
        ),
      ),
    ];
    const legacyStars = Number.isSafeInteger(raw.stars)
      ? Math.max(0, raw.stars)
      : 0;
    w.starPoints =
      raw.v >= 3 && Number.isSafeInteger(raw.starPoints)
        ? Math.max(0, Math.min(3460, raw.starPoints))
        : STAR_THRESHOLDS[Math.min(9, legacyStars)];
    if ((raw.v || 0) < 3 && legacyStars > 9) w.earned += (legacyStars - 9) * 20;
    w.stars = rank(w).completed;
    w.starsSpent = Number.isSafeInteger(raw.starsSpent)
      ? Math.max(0, raw.starsSpent)
      : 0;
    w.pointDay = typeof raw.pointDay === "string" ? raw.pointDay : "";
    w.pointEarned = Number.isInteger(raw.pointEarned)
      ? Math.max(0, Math.min(150, raw.pointEarned))
      : 0;
    w.pointLost = Number.isInteger(raw.pointLost)
      ? Math.max(0, Math.min(10, raw.pointLost))
      : 0;
    w.avatar = AVATARS.includes(raw.avatar) ? raw.avatar : "🦊";
    for (const k of ["perfect", "failed", "completedDays", "milestones"])
      w[k] = [
        ...new Set(
          (Array.isArray(raw[k]) ? raw[k] : []).filter(
            (x) => typeof x === "string" && x.length <= 100,
          ),
        ),
      ].slice(-10000);
    if (raw.daily && typeof raw.daily.day === "string")
      w.daily = {
        day: raw.daily.day,
        ids: [
          ...new Set(
            (raw.daily.ids || []).filter(
              (x) => typeof x === "string" && x.length <= 120,
            ),
          ),
        ].slice(0, 100),
      };
    for (const slot of SLOTS)
      if (
        CATALOG.some((x) => x.id === raw.wear?.[slot] && x.kind === slot) &&
        w.owned.includes(raw.wear[slot])
      )
        w.wear[slot] = raw.wear[slot];
    for (const k of ["match", "articles", "recall"])
      w[k] = [
        ...new Set(
          (Array.isArray(raw[k]) ? raw[k] : []).filter(
            (x) => typeof x === "string" && /^[a-z0-9._-]{1,80}$/i.test(x),
          ),
        ),
      ].slice(0, 100);
    for (const [id, v] of Object.entries(raw.reading || {}))
      if (
        /^[a-z0-9._-]{1,80}$/i.test(id) &&
        Number.isInteger(v) &&
        v >= 0 &&
        v <= 3
      )
        w.reading[id] = v;
    for (const [id, v] of Object.entries(raw.weak || {}))
      if (/^[a-z0-9._-]{1,80}$/i.test(id) && Number.isInteger(v) && v > 0)
        w.weak[id] = Math.min(v, 99);
    w.reviews = Array.isArray(raw.reviews)
      ? [
          ...new Set(
            raw.reviews.filter(
              (n) => typeof n === "string" && /^[a-f0-9]{16}$/.test(n),
            ),
          ),
        ].slice(0, 10000)
      : [];
    w.failed = w.failed.slice(-400);
    w.completedDays = w.completedDays.slice(-4000);
    w.lastDay = typeof raw.lastDay === "string" ? raw.lastDay : "";
    w.history = Array.isArray(raw.history) ? raw.history.slice(-50) : [];
    return w;
  }
  const reviewKey = (id) => {
    let a = 2166136261,
      b = 2246822507;
    for (const ch of id) {
      a = Math.imul(a ^ ch.charCodeAt(0), 16777619) >>> 0;
      b = Math.imul(b ^ ch.charCodeAt(0), 3266489909) >>> 0;
    }
    return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
  };
  const balance = (w) => Math.max(0, w.earned - w.spent);
  function apply(
    raw,
    event,
    { day, words, stories, cardIds = [], kids = false },
  ) {
    const w = normalize(raw);
    let amount = 0,
      note = "",
      eligible = false;
    if (event.op === "age") {
      if (kids || !["16-17", "18+"].includes(event.band))
        throw Error("This world is for ages 16+. Under 16? Use Kids & Family.");
      if (w.ageBand && w.ageBand !== event.band)
        throw Error(
          "Your age band is already set. Contact the operator to correct it.",
        );
      w.ageBand = event.band;
      return w;
    }
    if (event.op === "avatar") {
      if (!AVATARS.includes(event.id))
        throw Error("Choose an available avatar.");
      w.avatar = event.id;
      return w;
    }
    if (event.op === "buy") {
      const item = catalog(kids).find((x) => x.id === event.id);
      if (!item) throw Error("Unknown reward.");
      if (!kids && item.kind !== "content" && !w.ageBand)
        throw Error("Choose your 16+ age band first.");
      if (w.owned.includes(item.id)) return w;
      if (event.currency === "stars") {
        sacrifice(w, item.starPrice);
        note =
          "Unlocked " +
          item.title +
          " by sacrificing " +
          item.starPrice +
          " stars";
      } else {
        if (event.currency && event.currency !== "coins")
          throw Error("Unknown payment method.");
        if (balance(w) < item.price)
          throw Error(
            "Not enough coins yet. Keep learning; your coins do not expire.",
          );
        w.spent += item.price;
        note = "Unlocked " + item.title;
        amount = -item.price;
      }
      w.owned.push(item.id);
      if (!["content", "social"].includes(item.kind))
        w.wear[item.kind] = item.id;
    } else if (event.op === "equip") {
      if (
        !SLOTS.includes(event.slot) ||
        (kids && ["property", "vehicle", "club"].includes(event.slot))
      )
        throw Error("Unknown accessory slot.");
      if (event.id === null) delete w.wear[event.slot];
      else {
        const item = CATALOG.find((x) => x.id === event.id);
        if (!item || item.kind !== event.slot || !w.owned.includes(item.id))
          throw Error("Unlock this reward first.");
        w.wear[event.slot] = item.id;
      }
      return w;
    } else if (event.op === "event") {
      if (event.kind === "review") {
        const index = cardIds.includes(event.id) ? reviewKey(event.id) : null;
        if (kids || index === null) throw Error("Unknown review activity.");
        if (!w.reviews.includes(index)) {
          w.reviews.push(index);
          amount = w.reviews.length % 5 === 0 ? 1 : 0;
        }
        eligible = true;
        note = "First successful flashcard review";
      } else if (event.kind === "reading") {
        const s = stories.find((s) => s.id === event.id);
        if (!s || (kids && !s.kids)) throw Error("Unknown reading activity.");
        if (s.reward && !w.owned.includes(s.reward))
          throw Error("Unlock this story collection first.");
        if (s.stage > 1 && !(w.reading["journey-" + (s.stage - 1)] > 0))
          throw Error("Complete the previous stage first.");
        if (
          !Array.isArray(event.answers) ||
          event.answers.length !== s.questions.length ||
          event.answers.some(
            (a, i) =>
              !Number.isInteger(a) ||
              a < 0 ||
              a >= s.questions[i].options.length,
          )
        )
          throw Error("Complete all questions first.");
        const score = s.questions.filter(
          (q, i) => q.answer === event.answers[i],
        ).length;
        eligible = score > 0;
        const previous = w.reading[s.id];
        if (score === s.questions.length && !w.perfect.includes(s.id)) {
          changePoints(w, 10, day, kids);
          w.perfect.push(s.id);
        } else if (
          !kids &&
          score < s.questions.length &&
          !w.failed.includes(s.id)
        ) {
          changePoints(w, -5, day, kids);
          w.failed.push(s.id);
        }
        if (previous === undefined)
          amount = kids ? (score > 0 ? 10 : 0) : score >= 2 ? 3 : 0;
        else if (score > previous)
          amount = kids
            ? previous === 0
              ? 10
              : 2 * (score - previous)
            : previous < 2 && score >= 2
              ? 3
              : score === s.questions.length
                ? 1
                : 0;
        w.reading[s.id] = Math.max(previous || 0, score);
        note = "Story practice";
      } else {
        const word = words.find((x) => x.id === event.id);
        if (
          !word ||
          !["match", "articles", "recall", "mistake"].includes(event.kind)
        )
          throw Error("Unknown word activity.");
        if (event.kind === "mistake") {
          w.weak[word.id] = Math.min(99, (w.weak[word.id] || 0) + 1);
          const failure = day + ":" + word.id;
          if (!kids && !w.failed.includes(failure)) {
            changePoints(w, -2, day, kids);
            w.failed.push(failure);
          }
          return w;
        }
        if (!w[event.kind].includes(word.id)) {
          w[event.kind].push(word.id);
          amount = kids ? 2 : 1;
        }
        if (w.weak[word.id]) {
          w.weak[word.id]--;
          if (!w.weak[word.id]) delete w.weak[word.id];
        }
        note = "Word practice";
        eligible = true;
      }
      if (eligible && w.lastDay !== day) {
        amount += kids ? 3 : 1;
        w.lastDay = day;
        note += " + first practice of the day";
      }
      if (eligible) {
        if (w.daily.day !== day) w.daily = { day, ids: [] };
        const key = event.kind + ":" + event.id;
        if (!w.daily.ids.includes(key)) {
          w.daily.ids.push(key);
          changePoints(w, 2, day, kids);
        }
        if (
          w.daily.ids.length >= (kids ? 10 : 20) &&
          !w.completedDays.includes(day)
        ) {
          w.completedDays.push(day);
          changePoints(w, 25, day, kids);
          amount += kids ? 15 : 5;
          note += " + daily goal (25 star points)";
        }
        for (const [id, target, coins] of [
          ["starter", 1, 5],
          ["regular", 7, 30],
          ["dedicated", 30, 100],
          ["scholar", 100, 300],
        ])
          if (w.completedDays.length >= target && !w.milestones.includes(id)) {
            w.milestones.push(id);
            amount += kids ? coins : Math.max(1, Math.floor(coins / 5));
            note += " + " + id + " milestone";
          }
      }
      if (!kids) {
        if (w.coinDay !== day) {
          w.coinDay = day;
          w.dayCoins = 0;
        }
        amount = Math.min(amount, 20 - w.dayCoins);
        w.dayCoins += amount;
      }
      w.earned += amount;
    } else throw Error("Unknown reward action.");
    if (amount || note.startsWith("Unlocked"))
      w.history.push({ day, amount, note, id: event.id });
    w.history = w.history.slice(-50);
    return w;
  }
  root.DLRewardCore = {
    CATALOG,
    KIDS_CATALOG,
    catalog,
    STAR_THRESHOLDS,
    STAGES,
    rank,
    sacrifice,
    changePoints,
    AVATARS,
    SLOTS,
    empty,
    normalize,
    balance,
    reviewKey,
    apply,
  };
})(globalThis);
