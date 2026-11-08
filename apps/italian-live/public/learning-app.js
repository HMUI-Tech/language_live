/* Italian Live UI. Depends on window.DLCore (pure logic) and the shared content catalogue.
 * Sections: helpers · persistence · audio · AI · views (today, cards, talk, tutor, progress) · boot
 */
(async function () {
  "use strict";
  const C = window.DLCore;
  const CONTENT = await window.DLContent.load().catch(() => {
    window.DLContent.showError(document, () => location.reload());
    return null;
  });
  if (!CONTENT) return;
  const SITUATIONS = CONTENT.packs.filter((p) => p.dialogue); // packs with a scene and dialogue
  const LEVELS = ["A1", "A2", "B1", "B2"];
  let LOCAL_KEY = "italian-live:guest:v1";
  const LOG_DAYS_KEPT = 180;
  const BLOCKS = [
    {
      key: "review",
      share: 25,
      title: "Ripasso",
      sub: "Due cards",
      view: "cards",
    },
    {
      key: "new",
      share: 40,
      title: "Nuove parole",
      sub: "Today's pack",
      view: "cards",
    },
    {
      key: "dialog",
      share: 30,
      title: "Dialogo",
      sub: "Scripted scene",
      view: "talk",
    },
    {
      key: "tutor",
      share: 45,
      title: "Conversazione IA",
      sub: "Role-play with corrections",
      view: "tutor",
    },
    {
      key: "shadow",
      share: 40,
      title: "Ripeti",
      sub: "Listen and repeat aloud",
      view: "talk",
      mode: "shadow",
    },
    {
      key: "write",
      share: 30,
      title: "Scrivere",
      sub: "Short text, corrected",
      view: "tutor",
      mode: "write",
    },
  ];

  // ---------- helpers ----------
  const $ = (sel, el) => (el || document).querySelector(sel);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "value") el.value = v;
      else if (k === "html")
        el.innerHTML = v; // only used with trusted, static SVG strings
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat())
      if (kid != null && kid !== false)
        el.append(kid.nodeType ? kid : String(kid));
    return el;
  }
  const ICON = {
    today:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
    cards:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="6" width="13" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/></svg>',
    talk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v10H9l-5 4z"/></svg>',
    tutor:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 19l-5-3-5 3 1.4-6.2L4 9l5.8-.7z"/></svg>',
    articles:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16"/></svg>',
    english:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h15l-4-4M20 17H5l4 4M19 7l-4 4M5 17l4-4"/></svg>',
    progress:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    slow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 6v12l9-6z"/><path d="M19 6v12"/></svg>',
  };
  const icon = (name) =>
    h("span", {
      html: ICON[name],
      "aria-hidden": "true",
      style: "display:inline-grid",
    });
  function today() {
    return C.todayStr();
  }
  function shuffleSeeded(arr, seed) {
    let s = 0;
    for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) >>> 0;
      const j = s % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function toast(msg) {
    const t = h("div", { class: "toast", role: "status" }, msg);
    document.body.append(t);
    setTimeout(() => t.remove(), 2600);
  }
  function articleWord(item) {
    if (item.pos !== "noun" || !item.art) return h("span", {}, item.de);
    return h(
      "span",
      {},
      h("span", { class: `art art-${item.art}` }, item.art),
      item.art.endsWith("'") ? "" : " ",
      item.de,
    );
  }

  // ---------- persistence ----------
  // State lives in a few documents: meta (settings, log, dialogue scores), one per pack of cards, and custom items.
  function emptyState() {
    return {
      settings: { start: today(), minutes: 210, newPerDay: 20 },
      log: {},
      dlg: {},
      cards: {},
      custom: {},
      play: window.DLPlayCore.empty(),
      reading: {},
      updated: 0,
    };
  }
  function toDocs(state) {
    const docs = {
      meta: {
        v: 1,
        updated: state.updated,
        settings: state.settings,
        log: pruneLog(state.log),
        dlg: state.dlg,
        play: state.play,
        reading: state.reading,
      },
      custom: { items: state.custom },
    };
    for (const [id, card] of Object.entries(state.cards)) {
      const name = "cards-" + id.split(".")[0];
      (docs[name] = docs[name] || { cards: {} }).cards[id] = card;
    }
    return docs;
  }
  function fromDocs(docs) {
    const s = emptyState();
    if (!docs || !docs.meta) return null;
    Object.assign(s.settings, docs.meta.settings || {});
    s.log = docs.meta.log || {};
    s.dlg = docs.meta.dlg || {};
    s.play = window.DLPlayCore.sanitize(docs.meta.play, today());
    s.reading = window.DLReadingCore.sanitize(
      docs.meta.reading,
      window.DLReadingStories,
    );
    s.updated = docs.meta.updated || 0;
    s.custom = (docs.custom && docs.custom.items) || {};
    for (const [name, doc] of Object.entries(docs))
      if (name.startsWith("cards-")) Object.assign(s.cards, doc.cards || {});
    return s;
  }
  function pruneLog(log) {
    const cutoff = C.addDays(today(), -LOG_DAYS_KEPT);
    return Object.fromEntries(Object.entries(log).filter(([d]) => d >= cutoff));
  }

  const localBackend = {
    load() {
      if (!window.DLUser) return null;
      try {
        return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
      } catch {
        return null;
      }
    },
    save(docs) {
      if (!window.DLUser) return false;
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(docs));
        return true;
      } catch {
        return false;
      }
    },
  };

  const store = {
    state: emptyState(),
    remote: false,
    revision: 0,
    pending: Promise.resolve(),
    lastSaved: {},
    timer: null,
    status: "local",
    conflict: false,
    async init() {
      try {
        await window.DLAuthReady;
        const user = await window.DLAuth.getUser();
        window.DLUser = user;
        LOCAL_KEY = user
          ? "italian-live:user:" + user.id
          : "italian-live:guest:v1";
        const local = fromDocs(localBackend.load());
        if (local) this.state = local;
        accountBar(user);
        if (!user) return;
        const data = await window.DLAuth.loadProgress();
        this.revision = data.revision;
        const remote = fromDocs(data.docs);
        if (remote) {
          if (
            local &&
            local.updated > remote.updated &&
            confirm(
              "This browser has newer progress. Upload it to your account? Cancel keeps the account version.",
            )
          ) {
            this.state = local;
          } else {
            if (local && local.updated > remote.updated)
              localStorage.setItem(
                LOCAL_KEY + ":recovery",
                JSON.stringify(toDocs(local)),
              );
            this.state = remote;
          }
        }
        this.remote = true;
        if (!remote || this.state === local) await this.save(true);
        this.setStatus("cloud");
      } catch {
        this.setStatus("error");
      }
    },
    change() {
      this.state.updated = Date.now();
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.save(), 1200);
    },
    async save() {
      clearTimeout(this.timer);
      const docs = toDocs(this.state);
      localBackend.save(docs);
      if (!this.remote || this.conflict) return;
      this.pending = this.pending
        .catch(() => {})
        .then(async () => {
          try {
            const result = await window.DLAuth.saveProgress(
              docs,
              this.revision,
            );
            this.revision = result.revision;
            this.setStatus("cloud");
          } catch (e) {
            if (e.conflict) this.conflict = true;
            this.setStatus("error");
            toast(e.message);
          }
        });
      return this.pending;
    },
    setStatus(s) {
      this.status = s;
      const el = $("#sync");
      if (!el) return;
      el.dataset.state = s;
      el.textContent = {
        cloud: "Synced",
        local: window.DLUser ? "This device" : "Guest · not saved",
        error: "Not synced",
      }[s];
      el.title = {
        cloud:
          "Progress is saved to your account and appears on your phone and laptop.",
        local: window.DLUser
          ? "Progress is saved in this browser only."
          : "Guest progress is lost when you leave or refresh.",
        error:
          "Could not reach your account. Progress is kept on this device and syncs later.",
      }[s];
    },
  };
  function logToday(field, n) {
    const d = today();
    const entry = (store.state.log[d] = store.state.log[d] || {});
    entry[field] = (entry[field] || 0) + (n || 1);
  }

  // ---------- audio (browser text-to-speech) ----------
  const tts = {
    ok:
      typeof window.speechSynthesis !== "undefined" &&
      typeof window.SpeechSynthesisUtterance !== "undefined",
    voice: null,
    pick() {
      if (!this.ok) return;
      const voices = speechSynthesis
        .getVoices()
        .filter((v) => /^it(-|_|$)/i.test(v.lang));
      this.voice =
        voices.find(
          (v) =>
            /it-IT/i.test(v.lang) &&
            /natural|premium|enhanced|google/i.test(v.name),
        ) ||
        voices.find((v) => /it-IT/i.test(v.lang)) ||
        voices[0] ||
        null;
    },
    say(text, rate) {
      if (!this.ok) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/…/g, ""));
        u.lang = "it-IT";
        if (this.voice) u.voice = this.voice;
        u.rate = rate || 0.95;
        speechSynthesis.speak(u);
      } catch {
        /* audio is optional */
      }
    },
  };
  if (tts.ok) {
    tts.pick();
    try {
      speechSynthesis.addEventListener("voiceschanged", () => tts.pick());
    } catch {
      /* older Safari */
    }
  }
  function speakBtn(text, opts) {
    if (!tts.ok) return null;
    const o = opts || {};
    return h(
      "button",
      {
        class: "icon-btn" + (o.small ? " mini" : ""),
        type: "button",
        "aria-label": o.label || "Play audio",
        title: o.label || "Play audio",
        onclick: (e) => {
          e.stopPropagation();
          tts.say(text, o.rate);
        },
      },
      icon(o.rate && o.rate < 0.9 ? "slow" : "play"),
    );
  }

  // ---------- AI (Claude, through the page's sample capability) ----------
  const ai = {
    fn: null,
    ready: false,
    async init() {
      this.fn = null;
      this.ready = true;
      if (state.view === "tutor") render();
    },
    message(code) {
      return (
        {
          not_granted:
            "Claude access was declined for this page. Reload the page to be asked again.",
          sampling_disabled: "Claude isn't available on this account.",
          rate_limited:
            "Too many requests or your usage limit is reached. Try again in a little while.",
          session_expired: "Please sign in to Claude again.",
          invalid_json: "The tutor's answer came back garbled. Send again.",
          refused: "Claude declined that message. Try wording it differently.",
        }[code] || "The tutor couldn't answer just now. Send again."
      );
    },
    available() {
      return !!this.fn;
    },
  };

  // ---------- app state & routing ----------
  const state = {
    view: "today",
    talkMode: "dialog",
    tutorMode: "chat",
    packId: null,
    session: null,
    dlgRun: null,
    chat: null,
    writing: null,
  };

  function currentSituation() {
    const cards = store.state.cards;
    return (
      SITUATIONS.find((p) => p.items.some((i) => !(i.id in cards))) ||
      SITUATIONS[SITUATIONS.length - 1]
    );
  }
  /** A situation pack by id (dialogues, shadowing, tutor scenes, writing tasks). */
  function packById(id) {
    return SITUATIONS.find((p) => p.id === id) || currentSituation();
  }
  function allItems() {
    return C.indexItems(CONTENT, store.state.custom);
  }

  function go(view, mode) {
    state.view = view;
    if (view === "talk" && mode) state.talkMode = mode;
    if (view === "tutor" && mode) state.tutorMode = mode;
    try {
      history.replaceState(null, "", "#" + view);
    } catch {
      /* sandboxed history */
    }
    render();
    window.scrollTo(0, 0);
  }

  // ---------- shell ----------
  function renderShell() {
    const s = store.state.settings,
      week = C.weekOf(s.start, today()),
      app = $("#app");
    const items = [
      ["today", "Oggi"],
      ["play", "Giocare"],
      ["reading", "Leggere"],
      ["cards", "Carte"],
      ["talk", "Parlare"],
      ["tutor", "Tutor"],
      ["articles", "Articoli"],
      ["english", "Inglese"],
      ["progress", "Progressi"],
      ["shop", "Ricompense"],
    ];
    const navigation = LLNavigation.create({
      h,
      items,
      selected: state.view,
      user: accountUser,
      accountContent,
      coins: window.DLRewardCore.balance(window.DLRewardClient.get()),
      onNavigate: (view) => {
        go(view);
        document.querySelector("#view")?.focus({ preventScroll: true });
      },
    });
    app.replaceChildren(
      h(
        "div",
        { class: "shell" },
        h(
          "header",
          { class: "topbar" },
          h(
            "div",
            { class: "header-brand" },
            h(
              "div",
              { class: "brand" },
              h("span", { class: "brand-mark", "aria-hidden": "true" }, "I"),
              "Italian Live",
            ),
            h(
              "div",
              { class: "header-subline" },
              h(
                "span",
                { class: "week-chip" },
                `Settimana ${week} · ${C.phaseFor(week).level}`,
              ),
              h(
                "span",
                { class: "header-section" },
                items.find(([id]) => id === state.view)?.[1] || items[0][1],
              ),
            ),
          ),
          h("span", { id: "sync", class: "sync", "data-state": store.status }),
          navigation.trigger,
        ),
        navigation.dialog,
        h("main", { id: "view", tabindex: "-1" }),
        LLNavigation.footer(h),
      ),
    );
    store.setStatus(store.status);
  }

  let keyHandler = null;
  function setKeyHandler(fn) {
    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = fn;
    if (fn) document.addEventListener("keydown", fn);
  }

  function render() {
    const usageEvent = {
      cards: "cards_open",
      talk: "talk_open",
      articles: "articles_open",
      english: "english_open",
    }[state.view];
    if (usageEvent) window.LLAnalytics?.track(usageEvent);
    stopListening();
    setKeyHandler(null);
    renderShell();
    const view = $("#view");
    const requested = state.view;
    if (!window.DLLazy.ready(requested)) {
      view.append(h("p", { role: "status" }, "Loading practice…"));
      window.DLLazy.load(requested)
        .then(() => {
          if (state.view === requested) render();
        })
        .catch(() => {
          if (state.view === requested)
            view.replaceChildren(
              h(
                "p",
                {},
                "This screen could not load. Your progress stays saved.",
              ),
              h(
                "button",
                { class: "btn", type: "button", onclick: render },
                "Retry",
              ),
            );
        });
      return;
    }
    const fn =
      {
        shop: viewRewards,
        reading: viewReading,
        play: viewPlay,
        today: viewToday,
        cards: viewCards,
        talk: viewTalk,
        tutor: viewTutor,
        articles: viewArticles,
        english: viewEnglish,
        progress: viewProgress,
      }[state.view] || viewToday;
    view.append(...[].concat(fn()));
  }

  function rewardEvent(kind, id) {
    window.DLRewardClient.act({ op: "event", kind, id }).catch((e) =>
      toast(e.message),
    );
  }
  function viewRewards() {
    return [
      window.DLRewardUI.create({
        h,
        getWallet: () => DLRewardClient.get(),
        act: (e) => DLRewardClient.act(e),
        guest: DLRewardClient.isGuest(),
        speak: (text) => tts.say(text),
      }),
    ];
  }
  function viewReading() {
    return [
      window.DLReadingUI.create({
        h,
        today,
        getProgress: () => store.state.reading,
        onComplete: (next) => {
          store.state.reading = next;
          store.change();
        },
        onActivity: () => window.LLAnalytics?.track("learning_started"),
        speak: (text) =>
          text ? tts.say(text) : window.speechSynthesis?.cancel(),
        onResult: (event) =>
          DLRewardClient.act(event).catch((e) => toast(e.message)),
        signedIn: !!window.DLUser,
      }),
    ];
  }
  function viewPlay() {
    return [
      window.DLPlayUI.create({
        h,
        today,
        getProgress: () => store.state.play,
        getLog: () => store.state.log,
        onChange: (next) => {
          store.state.play = next;
          store.change();
        },
        speak: (text) => tts.say(text),
        onActivity: () => window.LLAnalytics?.track("learning_started"),
        onEvent: (kind, id) => rewardEvent(kind, id),
        onMistake: (id) => rewardEvent("mistake", id),
        navigate: (view) => go(view),
      }),
    ];
  }

  // ---------- WORD GUIDES (reference only; no account or progress writes) ----------
  function guideSources() {
    return h(
      "p",
      { class: "small muted" },
      "Sources and further reading: ",
      h("a", { href: "/credits.html" }, "Dictionary credits and licences"),
      " · ",
      h(
        "a",
        {
          href: "https://www.treccani.it/enciclopedia/articoli-determinativi_(La-grammatica-italiana)/",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "Treccani · Italian articles",
      ),
    );
  }
  function guideExample(article, word, meaning) {
    const full = article
      ? article + (article.endsWith("'") ? "" : " ") + word
      : word;
    return h(
      "div",
      { class: "guide-example" },
      h(
        "span",
        { class: "de", lang: "it" },
        article
          ? h("span", { class: "art art-" + article }, article + " ")
          : null,
        word,
      ),
      h("span", { class: "muted small" }, meaning),
      speakBtn(full, { small: true, label: "Listen to " + full }),
    );
  }
  function viewArticles() {
    let selected = "all";
    const results = h("div", { class: "guide-grid" });
    const count = h("p", { class: "small muted", role: "status" });
    const search = h("input", {
      type: "search",
      placeholder: "Search an ending or example: -keit, Training…",
      "aria-label": "Search article patterns",
      class: "guide-search",
    });
    const paint = () => {
      const query = search.value.trim().toLocaleLowerCase("it-IT");
      const rules = window.DLGuides.rules.filter(
        (r) =>
          (selected === "all" ||
            r.article === selected ||
            r.article === "both") &&
          JSON.stringify(r).toLocaleLowerCase("it-IT").includes(query),
      );
      count.textContent =
        rules.length + (rules.length === 1 ? " pattern" : " patterns");
      results.replaceChildren(
        ...rules.map((r) =>
          h(
            "section",
            { class: "panel guide-rule" },
            h(
              "div",
              { class: "row" },
              h("span", { class: "guide-article art-" + r.article }, r.article),
              h("h2", {}, r.ending),
            ),
            h("span", { class: "small muted" }, r.strength),
            ...r.ex.map(([word, meaning]) => guideExample("", word, meaning)),
            h("p", { class: "small" }, r.note),
          ),
        ),
      );
      if (!rules.length)
        results.append(
          h(
            "p",
            { class: "note" },
            "No matching patterns. Try another ending or choose All.",
          ),
        );
    };
    const filters = h(
      "div",
      {
        class: "seg guide-filters",
        role: "group",
        "aria-label": "Filter by article",
      },
      [
        ["all", "All"],
        ["masculine", "Masculine"],
        ["feminine", "Feminine"],
      ].map(([value, label]) =>
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(value === selected),
            onclick: (e) => {
              selected = value;
              for (const button of filters.querySelectorAll("button"))
                button.setAttribute("aria-pressed", "false");
              e.currentTarget.setAttribute("aria-pressed", "true");
              paint();
            },
          },
          label,
        ),
      ),
    );
    search.addEventListener("input", paint);
    paint();
    return [
      h(
        "section",
        { class: "stack" },
        h("p", { class: "eyebrow" }, "Parole · Word patterns"),
        h("h1", {}, "Il, lo, la o l’ ?"),
        h(
          "p",
          {},
          "Learn masculine and feminine noun patterns, definite articles and plurals. Memorise the article together with each noun.",
        ),
      ),
      h(
        "aside",
        { class: "note stack" },
        h("h2", {}, "Gender + number + first sound"),
        h(
          "p",
          {},
          "il libro → i libri · lo studente → gli studenti · la casa → le case · l’amico → gli amici · l’amica → le amiche.",
        ),
        h(
          "p",
          { class: "small" },
          "Italian has masculine and feminine nouns, without a neuter article. The article depends on gender, singular/plural and the next sound. L’ can be masculine or feminine; learn the noun’s gender separately.",
        ),
      ),
      search,
      filters,
      count,
      results,
      guideSources(false),
    ];
  }
  let bridgeRows = null;
  let bridgeRequest = null;
  function loadBridgeRows() {
    if (bridgeRows) return Promise.resolve(bridgeRows);
    if (!bridgeRequest)
      bridgeRequest = fetch("/data/word-bridges.json")
        .then((response) => {
          if (!response.ok) throw new Error("Dictionary unavailable");
          return response.json();
        })
        .then((rows) => {
          if (
            !Array.isArray(rows) ||
            rows.length !== 3960 ||
            rows.some(
              (r) =>
                !Array.isArray(r) ||
                r.length !== 6 ||
                r.some((x) => typeof x !== "string"),
            )
          )
            throw new Error("Invalid dictionary");
          bridgeRows = rows;
          return rows;
        })
        .catch((error) => {
          bridgeRequest = null;
          throw error;
        });
    return bridgeRequest;
  }
  function viewEnglish() {
    const patterns = [
      [
        "tion",
        "-tion → -zione",
        "nation → nazione; communication → comunicazione. Many such nouns are feminine.",
      ],
      [
        "sion",
        "-sion → -sione",
        "decision → decisione; television → televisione. Meanings may overlap only in some contexts.",
      ],
      [
        "ity",
        "-ity → -ità",
        "quality → qualità; possibility → possibilità. These nouns normally keep the same form in the plural.",
      ],
      [
        "ic",
        "-ic / -ical → -ico",
        "logical → logico; practical → pratico. Adjective endings change for gender and number.",
      ],
      [
        "ive",
        "-ive → -ivo",
        "active → attivo; creative → creativo. Learn the feminine and plural forms too.",
      ],
      [
        "ism",
        "-ism → -ismo",
        "tourism → turismo; realism → realismo. These nouns are generally masculine.",
      ],
      [
        "y",
        "-y → -ia",
        "biology → biologia; technology → tecnologia. A family resemblance, not a universal translation rule.",
      ],
    ];
    const matchesPattern = (row, id) =>
      ({
        tion: /zione$/,
        sion: /sione$/,
        ity: /ità$/,
        ic: /ico$/,
        ive: /ivo$/,
        ism: /ismo$/,
        y: /ia$/,
      })[id].test(row[0]);
    const level = h(
      "select",
      { "aria-label": "Suggested learning level" },
      [
        ["all", "All learning stages"],
        ["ungraded", "Dictionary · level not assessed"],
        ...["A1", "A2", "B1", "B2"].map((x) => [x, x + " · suggested"]),
      ].map(([value, label]) => h("option", { value }, label)),
    );
    const pattern = h(
      "select",
      { "aria-label": "Spelling pattern" },
      [
        ["all", "All spelling patterns"],
        ...patterns.map((x) => [x[0], x[1]]),
      ].map(([value, label]) => h("option", { value }, label)),
    );
    const patternNote = h("p", { class: "note small" });

    let selected = "all",
      page = 0;
    const pageSize = 48;
    const loading = h("p", { class: "small muted", role: "status" });
    const previous = h(
      "button",
      {
        type: "button",
        onclick: () => {
          page--;
          paint();
        },
      },
      "Previous",
    );
    const next = h(
      "button",
      {
        type: "button",
        onclick: () => {
          page++;
          paint();
        },
      },
      "Next",
    );
    const pageLabel = h("span", { class: "small", role: "status" });
    const pager = h(
      "nav",
      { class: "guide-filters", "aria-label": "Word pair pages" },
      previous,
      pageLabel,
      next,
    );
    const results = h("div", { class: "guide-grid" });
    const count = h("p", { class: "small muted", role: "status" });
    const search = h("input", {
      type: "search",
      class: "guide-search",
      placeholder: "Search English or Italian: music, musica…",
      "aria-label": "Search English and Italian words",
    });
    const paint = () => {
      const query = search.value.trim().toLocaleLowerCase("it-IT");
      const falseMode = selected === "false";
      level.disabled = falseMode;
      pattern.disabled = falseMode;
      patternNote.textContent = falseMode
        ? "False friends have different meanings despite similar spelling. Level and spelling filters do not apply here."
        : patterns.find((x) => x[0] === pattern.value)?.[2] ||
          "Choose a spelling pattern to explore a word family. These are learning clues, not rules for translating every English word.";
      const rows = (
        falseMode
          ? window.DLGuides.falseFriends
          : window.DLGuides.pairs.concat(
              window.DLGuides.extraPairs,
              bridgeRows || [],
            )
      ).filter(
        (row) =>
          (selected === "all" || falseMode || row[2] === selected) &&
          (falseMode ||
            level.value === "all" ||
            (row[5] || "A1") === level.value) &&
          (falseMode ||
            pattern.value === "all" ||
            matchesPattern(row, pattern.value)) &&
          row.join(" ").toLocaleLowerCase("it-IT").includes(query),
      );
      count.textContent =
        rows.length +
        (falseMode
          ? rows.length === 1
            ? " false friend"
            : " false friends"
          : rows.length === 1
            ? " word pair"
            : " word pairs");
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      page = Math.max(0, Math.min(page, pages - 1));
      previous.disabled = page === 0;
      next.disabled = page >= pages - 1;
      pageLabel.textContent = rows.length
        ? `Page ${page + 1} of ${pages} · ${page * pageSize + 1}–${Math.min(rows.length, (page + 1) * pageSize)} of ${rows.length}`
        : "No results";
      results.replaceChildren(
        ...rows.slice(page * pageSize, (page + 1) * pageSize).map((row) => {
          const [de, en, group, example, translation] = row;
          return h(
            "section",
            { class: "panel" },
            guideExample("", de, en),
            falseMode
              ? h("p", { class: "small" }, "Watch out: " + group)
              : h("span", { class: "small muted" }, group),
            example ? h("p", { class: "de", lang: "it" }, example) : null,
            translation ? h("p", { class: "small muted" }, translation) : null,
            example
              ? speakBtn(example, {
                  small: true,
                  label: "Listen to example sentence",
                })
              : null,
          );
        }),
      );
      if (!rows.length)
        results.append(
          h(
            "p",
            { class: "note" },
            "No matches. Try another word or choose All similar words.",
          ),
        );
    };
    const filter = h(
      "select",
      { "aria-label": "Word pair category" },
      [
        ["all", "All similar words"],
        ["Everyday", "Everyday words"],
        ["Family", "Family & people"],
        ["Descriptions", "Descriptions"],
        ["Actions", "Actions"],
        ["International", "International words"],
        ["Dictionary", "Expanded dictionary"],
        ["false", "False friends · watch out!"],
      ].map(([value, label]) => h("option", { value }, label)),
    );
    filter.addEventListener("change", () => {
      selected = filter.value;
      page = 0;
      paint();
    });
    const resetPage = () => {
      page = 0;
      paint();
    };
    level.addEventListener("change", resetPage);
    pattern.addEventListener("change", resetPage);
    search.addEventListener("input", resetPage);
    paint();
    const load = () => {
      loading.textContent = "Loading the expanded dictionary…";
      loadBridgeRows()
        .then(() => {
          loading.textContent =
            "4,000 word pairs available · 40 with original example sentences; 3,960 dictionary-derived spelling matches.";
          paint();
        })
        .catch(() => {
          loading.replaceChildren(
            "Expanded dictionary could not load. The 40 example pairs are still available. ",
            h("button", { type: "button", onclick: load }, "Retry"),
          );
        });
    };
    load();
    return [
      h(
        "section",
        { class: "stack" },
        h("p", { class: "eyebrow" }, "Ponti di parole · Word bridges"),
        h("h1", {}, "English ↔ Italiano"),
        h(
          "p",
          {},
          "You already know more Italian than you think. Discover related words and shared loanwords, with articles where available, meanings and example sentences in the starter selection.",
        ),
      ),
      h(
        "aside",
        { class: "note stack" },
        h(
          "p",
          {},
          "English → inglese. Italian → italiano. Language names and nationality adjectives are normally lowercase in Italian.",
        ),
        h(
          "p",
          { class: "small" },
          "Similar spelling does not guarantee the same meaning or pronunciation. Use the audio buttons and explore False friends. The meanings shown are common uses, not every dictionary meaning. Language names can appear without an article: Parlo inglese.",
        ),
      ),
      h(
        "p",
        { class: "small muted" },
        "A broad selection, not a complete dictionary. The expanded entries are automatically selected from dictionary translations for similar spelling and ranked by usage frequency; they are not individually reviewed lessons or proof of shared etymology. Some words are technical or less common. Meanings may overlap only in a specific context. Learning stages apply only to the 40 editorial examples, not the imported dictionary.",
      ),
      search,
      filter,
      level,
      pattern,
      patternNote,
      loading,
      count,
      results,
      pager,
      h(
        "p",
        { class: "small muted" },
        "Dictionary source: Wiktionary contributors via Kaikki/Wiktextract, CC BY-SA 4.0. ",
        h(
          "a",
          { href: "/credits.html" },
          "Credits, licences and downloadable data",
        ),
      ),
      guideSources(true),
    ];
  }

  // ---------- TODAY ----------
  function blockStatus(key) {
    const d = today();
    const log = store.state.log[d] || {};
    const cards = store.state.cards;
    const q = C.buildQueue(CONTENT, cards, d, 0);
    const pack = currentSituation();
    switch (key) {
      case "review":
        if (q.due.length) return { done: false, text: q.due.length + " due" };
        return {
          done: true,
          text: log.reviews ? log.reviews + " reviewed" : "Nothing due yet",
        };
      case "new": {
        const n = C.newIntroducedToday(cards, d);
        const goal = store.state.settings.newPerDay;
        return { done: n >= goal, text: `${Math.min(n, goal)} / ${goal} new` };
      }
      case "dialog": {
        const r = store.state.dlg[pack.id];
        return { done: !!r && r.last === d, text: pack.title };
      }
      case "tutor":
        return {
          done: (log.turns || 0) >= 8,
          text: `${log.turns || 0} / 8 turns`,
        };
      case "shadow":
        return {
          done: (log.shadow || 0) >= 10,
          text: `${log.shadow || 0} / 10 sentences`,
        };
      case "write":
        return {
          done: (log.writes || 0) >= 1,
          text: log.writes ? "Done" : "One text",
        };
      default:
        return { done: false, text: "" };
    }
  }

  function viewToday() {
    const s = store.state.settings;
    const d = today();
    const week = C.weekOf(s.start, d);
    const st = C.stats(store.state.cards, store.state.log, d);
    const target = C.targetWords(week);
    const statuses = BLOCKS.map((b) => blockStatus(b.key));
    const nextIdx = statuses.findIndex((x) => !x.done);
    const dateLabel = new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const pct = Math.min(100, (st.learned / 4000) * 100);
    const targetPct = Math.min(100, (target / 4000) * 100);

    return [
      h(
        "section",
        { class: "today-head" },
        h("p", { class: "eyebrow" }, dateLabel),
        h(
          "h1",
          {},
          nextIdx === -1 ? "Tutto fatto. A domani!" : "Il tuo piano di oggi",
        ),
        h(
          "p",
          { class: "muted" },
          `Week ${week} of 26 · ${s.minutes} min plan · ${st.streak} day streak`,
        ),
      ),
      h(
        "section",
        { class: "panel goal", "aria-label": "Vocabulary practice progress" },
        h(
          "div",
          { class: "row", style: "justify-content:space-between" },
          h(
            "span",
            { class: "small" },
            h("b", { class: "num" }, String(st.learned)),
            " words practised",
          ),
          h(
            "span",
            { class: "small muted num" },
            `target this week: ${target} · B2: 4,000`,
          ),
        ),
        h(
          "div",
          {
            class: "bar",
            role: "img",
            "aria-label": `${st.learned} of 4000 words; this week's target is ${target}`,
          },
          h("span", { style: `width:${pct}%` }),
          h("i", { style: `left:${targetPct}%` }),
        ),
        h(
          "p",
          { class: "small muted" },
          "The calendar plan is a study guide, not a language-level assessment. Review difficult words before adding more.",
        ),
        CONTENT.packs.every((p) =>
          p.items.every((i) => i.id in store.state.cards),
        )
          ? h(
              "p",
              { class: "small muted" },
              "You've started every pack in this version. New packs arrive as the word bank grows.",
            )
          : null,
      ),
      h(
        "ol",
        { class: "blocks", "aria-label": "Today's blocks" },
        BLOCKS.map((b, i) => {
          const stt = statuses[i];
          const mins = Math.round((b.share / 210) * s.minutes);
          return h(
            "li",
            {},
            h(
              "button",
              {
                class: "block",
                type: "button",
                onclick: () => go(b.view, b.mode),
              },
              h("span", { class: "mins" }, String(mins), h("small", {}, "MIN")),
              h(
                "span",
                { class: "what" },
                h("b", {}, b.title),
                h("span", {}, `${b.sub} · ${stt.text}`),
              ),
              h(
                "span",
                {
                  class:
                    "state" +
                    (stt.done ? " done" : i === nextIdx ? " next" : ""),
                },
                stt.done ? "Done" : i === nextIdx ? "Next" : "Open",
              ),
            ),
          );
        }),
      ),
    ];
  }

  // ---------- CARDS ----------
  function startSession() {
    window.LLAnalytics?.track("learning_started");
    const d = today();
    const cards = store.state.cards;
    const left = Math.max(
      0,
      store.state.settings.newPerDay - C.newIntroducedToday(cards, d),
    );
    const q = C.buildQueue(CONTENT, cards, d, left);
    // Interleave reviews with new words; each new word is shown, then tested about three cards later.
    const plan = C.sessionPlan(q, store.state.settings.minutes);
    const due = plan.due.slice();
    const fresh = plan.fresh.slice();
    const out = [];
    const pending = [];
    while (due.length || fresh.length || pending.length) {
      const ready = pending.findIndex((p) => p.at <= out.length);
      if (ready !== -1) {
        out.push({ id: pending.splice(ready, 1)[0].id, kind: "test" });
        continue;
      }
      if (fresh.length && (out.length % 2 === 0 || !due.length)) {
        const id = fresh.shift();
        out.push({ id, kind: "learn" });
        pending.push({ id, at: out.length + 3 });
        continue;
      }
      if (due.length) {
        out.push({ id: due.shift(), kind: "test" });
        continue;
      }
      out.push({ id: pending.shift().id, kind: "test" });
    }
    state.session = {
      queue: out,
      pos: 0,
      done: 0,
      correct: 0,
      again: {},
      phase: "ask",
      last: null,
      spoken: null,
      total: out.filter((s) => s.kind === "test").length,
    };
  }

  function viewCards() {
    const d = today();
    const q = C.buildQueue(
      CONTENT,
      store.state.cards,
      d,
      Math.max(
        0,
        store.state.settings.newPerDay -
          C.newIntroducedToday(store.state.cards, d),
      ),
    );
    const plan = C.sessionPlan(q, store.state.settings.minutes);
    const sess = state.session;
    const out = [];
    if (sess) {
      const byId = allItems();
      while (sess.pos < sess.queue.length && !byId[sess.queue[sess.pos].id])
        sess.pos += 1; // skip removed items
    }
    if (sess && sess.pos < sess.queue.length) {
      out.push(renderCardStep(sess));
    } else {
      if (sess && sess.pos >= sess.queue.length && sess.total) {
        out.push(
          h(
            "section",
            { class: "panel" },
            h("h2", {}, "Fertig! Session complete."),
            h(
              "p",
              {},
              `${sess.correct} of ${sess.done} answers right. Take a break or start another short set if more reviews are due.`,
            ),
          ),
        );
        state.session = null;
      }
      out.push(
        h(
          "section",
          { class: "stack" },
          h("p", { class: "eyebrow" }, "Carte"),
          h(
            "h1",
            {},
            q.due.length + q.fresh.length
              ? "Ready to practise"
              : "Nothing due right now",
          ),
          h(
            "p",
            { class: "muted" },
            `${q.due.length} due for review · ${q.fresh.length} new words left today`,
          ),
          h(
            "p",
            { class: "small muted" },
            `This sitting: up to ${plan.due.length} reviews and ${plan.fresh.length} new words. More due reviews stay available for another sitting.`,
          ),
          plan.pausedNew
            ? h(
                "p",
                { class: "note" },
                "New words are paused for this sitting while you catch up on reviews. Your existing words come first.",
              )
            : null,
          h(
            "div",
            { class: "row" },
            h(
              "button",
              {
                class: "btn primary",
                type: "button",
                disabled: !(q.due.length + q.fresh.length),
                onclick: () => {
                  startSession();
                  render();
                },
              },
              "Start session",
            ),
            q.due.length + q.fresh.length === 0
              ? h(
                  "button",
                  {
                    class: "btn",
                    type: "button",
                    onclick: () => {
                      store.state.settings.newPerDay += 10;
                      store.change();
                      render();
                    },
                  },
                  "Add 10 more new words",
                )
              : null,
          ),
        ),
      );
    }
    out.push(
      h(
        "section",
        { class: "stack" },
        h("h3", {}, "Word packs"),
        h(
          "p",
          { class: "small muted" },
          "Dictionary levels are frequency-based study bands, not assessed CEFR classifications. Following the 26-week plan does not certify a language level. Dictionary cards show one meaning; learn context through the dialogue packs.",
        ),
        renderPacks(),
      ),
    );
    return out;
  }

  function learnedIn(items) {
    const cards = store.state.cards;
    return items.filter(
      (i) => cards[i.id] && (cards[i.id].reps > 0 || cards[i.id].lapses > 0),
    ).length;
  }

  function packDetails(p, subtitle) {
    return h(
      "details",
      { class: "pack" },
      h(
        "summary",
        {},
        h("span", { class: "t" }, h("b", {}, p.title), h("span", {}, subtitle)),
        h(
          "span",
          { class: "pill num" },
          `${learnedIn(p.items)}/${p.items.length}`,
        ),
      ),
      h(
        "ul",
        { class: "wordlist" },
        p.items.map((i) =>
          h(
            "li",
            {},
            h(
              "div",
              {},
              h(
                "div",
                { class: "de" },
                articleWord(i),
                i.pl ? h("span", { class: "muted small" }, ` · ${i.pl}`) : null,
              ),
              h("div", { class: "en" }, i.en),
            ),
            speakBtn(C.expectedAnswer(i), {
              small: true,
              label: "Play " + i.de,
            }),
          ),
        ),
      ),
    );
  }

  function renderPacks() {
    const groups = LEVELS.map((level) => {
      const packs = CONTENT.packs.filter((p) => p.level === level);
      if (!packs.length) return null;
      const situations = packs.filter((p) => p.kind === "situation");
      const core = packs.filter(
        (p) => p.kind === "core" && !p.id.startsWith("pdf-supplement-"),
      );
      const supplement = packs.filter((p) =>
        p.id.startsWith("pdf-supplement-"),
      );
      const coreItems = core.flatMap((p) => p.items);
      const words = packs.reduce((n, p) => n + p.items.length, 0);
      return h(
        "section",
        { class: "stack", style: "gap:8px" },
        h(
          "div",
          { class: "row", style: "justify-content:space-between" },
          h("h2", {}, level),
          h("span", { class: "small muted num" }, `${words} words`),
        ),
        situations.map((p) => packDetails(p, `${p.title_en} · week ${p.week}`)),
        supplement.length
          ? h(
              "details",
              { class: "pack" },
              h(
                "summary",
                {},
                h(
                  "span",
                  { class: "t" },
                  h("b", {}, "PDF supplement"),
                  h(
                    "span",
                    {},
                    "Missing words · frequency bands, not assessed CEFR",
                  ),
                ),
                h(
                  "span",
                  { class: "pill num" },
                  String(supplement.reduce((n, p) => n + p.items.length, 0)),
                ),
              ),
              h(
                "div",
                { class: "packs", style: "padding:0 12px 12px" },
                supplement.map((p) => packDetails(p, p.title_en)),
              ),
            )
          : null,
        core.length
          ? h(
              "details",
              { class: "pack" },
              h(
                "summary",
                {},
                h(
                  "span",
                  { class: "t" },
                  h("b", {}, `Kernwortschatz ${level}`),
                  h(
                    "span",
                    {},
                    `Most frequent spoken words · ${core.length} sets`,
                  ),
                ),
                h(
                  "span",
                  { class: "pill num" },
                  `${learnedIn(coreItems)}/${coreItems.length}`,
                ),
              ),
              h(
                "div",
                { class: "packs", style: "padding:0 12px 12px" },
                core.map((p) => packDetails(p, `week ${p.week}`)),
              ),
            )
          : null,
      );
    });
    const custom = Object.entries(store.state.custom);
    if (custom.length) {
      groups.push(
        h(
          "details",
          { class: "pack" },
          h(
            "summary",
            {},
            h(
              "span",
              { class: "t" },
              h("b", {}, "Meine Fehler"),
              h("span", {}, "Corrections from the tutor, saved as cards"),
            ),
            h("span", { class: "pill num" }, String(custom.length)),
          ),
          h(
            "ul",
            { class: "wordlist" },
            custom.map(([, i]) =>
              h(
                "li",
                {},
                h(
                  "div",
                  {},
                  h("div", { class: "de" }, i.de),
                  h("div", { class: "en" }, i.en),
                ),
                speakBtn(i.de, { small: true }),
              ),
            ),
          ),
        ),
      );
    }
    return h("div", { class: "packs", style: "gap:20px" }, groups);
  }

  function renderCardStep(sess) {
    const step = sess.queue[sess.pos];
    const item = allItems()[step.id];
    const testsDone = sess.done;
    const top = h(
      "div",
      { class: "card-top" },
      h(
        "span",
        { class: "prog num" },
        `${testsDone} / ${sess.total} · ${step.kind === "learn" ? "new word" : "practice"}`,
      ),
      h(
        "button",
        {
          class: "linkish",
          type: "button",
          onclick: () => {
            state.session = null;
            render();
          },
        },
        "End session",
      ),
    );

    const speakOnce = (text) => {
      const key = `${sess.pos}:${sess.phase}`;
      if (sess.spoken === key) return;
      sess.spoken = key;
      setTimeout(() => tts.say(text), 60);
    };

    if (step.kind === "learn") {
      const next = () => {
        const d = today();
        if (!store.state.cards[item.id])
          store.state.cards[item.id] = C.newCard(d);
        store.change();
        advance(sess);
      };
      speakOnce(C.expectedAnswer(item));
      setKeyHandler((e) => {
        if (e.key === "Enter" && !e.repeat) next();
      });
      return h(
        "article",
        { class: "card" },
        top,
        h("p", { class: "hint" }, "New · " + labelPos(item)),
        h(
          "div",
          { class: "row" },
          h("div", { class: "word" }, articleWord(item)),
          speakBtn(C.expectedAnswer(item)),
        ),
        item.pl
          ? h(
              "p",
              { class: "muted" },
              "Plural: ",
              h("span", { class: "de" }, item.pl),
            )
          : null,
        h("p", { class: "prompt" }, item.en),
        item.ex
          ? h(
              "div",
              { class: "example" },
              h(
                "div",
                { class: "row" },
                h("span", { class: "de" }, item.ex),
                speakBtn(item.ex, { small: true }),
              ),
              h("span", { class: "muted small" }, item.ex_en),
            )
          : null,
        h(
          "button",
          {
            class: "btn primary block",
            type: "button",
            autofocus: true,
            onclick: next,
          },
          "Got it",
          h("span", { class: "kbd" }, "Enter"),
        ),
      );
    }

    const card = store.state.cards[item.id] || C.newCard(today());
    const listen = tts.ok && card.reps % 2 === 1;
    if (sess.phase === "ask") {
      const input = h("input", {
        id: "answer",
        class: "answer",
        type: "text",
        autocomplete: "off",
        autocapitalize: "off",
        spellcheck: "false",
        lang: "it",
        "aria-label": "Your answer in Italian",
        placeholder:
          item.pos === "noun" ? "il / lo / la / l' …" : "In italiano …",
      });
      const check = () => {
        sess.last = C.checkAnswer(item, input.value);
        sess.last.input = input.value;
        sess.phase = "graded";
        render();
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.repeat) {
          e.stopPropagation();
          check();
        }
      });
      if (listen) speakOnce(C.expectedAnswer(item));
      setTimeout(() => input.focus(), 50);
      return h(
        "article",
        { class: "card" },
        top,
        h(
          "p",
          { class: "hint" },
          (listen ? "Listen and write · " : "Say it in Italian · ") +
            labelPos(item),
        ),
        listen
          ? h(
              "div",
              { class: "row" },
              h(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onclick: () => tts.say(C.expectedAnswer(item)),
                },
                icon("play"),
                "Play again",
              ),
              h(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onclick: () => tts.say(C.expectedAnswer(item), 0.7),
                },
                icon("slow"),
                "Slower",
              ),
            )
          : h("p", { class: "prompt" }, item.en),
        input,
        h(
          "div",
          { class: "row" },
          h(
            "button",
            { class: "btn primary", type: "button", onclick: check },
            "Check",
            h("span", { class: "kbd" }, "Enter"),
          ),
          h(
            "button",
            {
              class: "btn",
              type: "button",
              onclick: () => {
                input.value = "";
                check();
              },
            },
            "I don't know",
          ),
        ),
      );
    }

    const r = sess.last;
    const good =
      r.result === "correct" || r.result === "close" || r.result === "accent";
    const headline = {
      correct: "Corretto!",
      close: "Almost: check the spelling",
      accent: "Meaning recognised — check the accent or umlaut",
      article: "Right word, wrong article",
      wrong: "Not quite — practise this again",
    }[r.result];
    const suggested = C.SUGGESTED_GRADE[r.result];
    const grade = (g) => gradeCard(sess, item, g, good);
    const grades =
      r.result === "wrong" || r.result === "article"
        ? [["again", "Practise again", "same session"]]
        : r.result === "close" || r.result === "accent"
          ? [
              ["again", "Again", "same session"],
              ["hard", "Hard", ""],
            ]
          : [
              ["again", "Again", "<1 day"],
              ["hard", "Hard", ""],
              ["good", "Good", ""],
              ["easy", "Easy", ""],
            ];
    setKeyHandler((e) => {
      const g =
        { 1: "again", 2: "hard", 3: "good", 4: "easy" }[e.key] ||
        (e.key === "Enter" && !e.repeat ? suggested : null);
      if (g) grade(g);
    });
    speakOnce(C.expectedAnswer(item));
    return h(
      "article",
      { class: "card" },
      top,
      h("p", { class: "prompt" }, item.en),
      h(
        "div",
        { class: "feedback " + (good ? "good" : "bad") },
        h("b", {}, headline),
        r.input
          ? h(
              "span",
              { class: "small" },
              "You wrote: ",
              h("span", { class: "de" }, r.input),
            )
          : null,
        h(
          "div",
          { class: "row" },
          h(
            "span",
            { class: "word", style: "font-size:26px" },
            articleWord(item),
          ),
          speakBtn(C.expectedAnswer(item), { small: true }),
        ),
      ),
      item.ex
        ? h(
            "div",
            { class: "example" },
            h("span", { class: "de" }, item.ex),
            h("span", { class: "muted small" }, item.ex_en),
          )
        : null,
      h(
        "div",
        {
          class: "grades",
          role: "group",
          "aria-label": "How well did you know it?",
        },
        grades.map(([g, label], i) =>
          h(
            "button",
            {
              class: "btn" + (g === suggested ? " suggest" : ""),
              type: "button",
              onclick: () => grade(g),
            },
            label,
            h("small", { class: "kbd" }, String(i + 1)),
          ),
        ),
      ),
    );
  }

  function labelPos(item) {
    return (
      {
        noun: "noun, with article",
        verb: "verb",
        adj: "adjective",
        adv: "adverb",
        phrase: "phrase",
        other: "word",
      }[item.pos] || "word"
    );
  }

  function gradeCard(sess, item, grade, answeredRight) {
    grade = C.gradeForAnswer(grade, sess.last?.result);
    const d = today();
    const card = store.state.cards[item.id] || C.newCard(d);
    store.state.cards[item.id] = C.review(card, grade, d);
    sess.done += 1;
    if (answeredRight && grade !== "again") sess.correct += 1;
    logToday("reviews");
    if (answeredRight && grade !== "again") rewardEvent("review", item.id);
    store.state.play = DLPlayCore.recordReview(
      store.state.play,
      today(),
      item.id,
      answeredRight && grade !== "again",
      store.state.log,
    );
    if (grade === "again") {
      const n = (sess.again[item.id] = (sess.again[item.id] || 0) + 1);
      if (n <= 3) {
        sess.queue.splice(Math.min(sess.pos + 4, sess.queue.length), 0, {
          id: item.id,
          kind: "test",
        });
        sess.total += 1;
      }
    }
    store.change();
    advance(sess);
  }
  function advance(sess) {
    sess.pos += 1;
    sess.phase = "ask";
    sess.last = null;
    render();
  }

  // ---------- TALK (dialogues + shadowing) ----------
  function packPicker(onChange) {
    const sel = h(
      "select",
      { id: "pack-pick", "aria-label": "Situation" },
      SITUATIONS.map((p) =>
        h(
          "option",
          { value: p.id, selected: p.id === packById(state.packId).id },
          `${p.title} · ${p.title_en}`,
        ),
      ),
    );
    sel.addEventListener("change", () => {
      state.packId = sel.value;
      onChange();
    });
    return sel;
  }
  function seg(options, current, onPick) {
    return h(
      "div",
      { class: "seg", role: "group" },
      options.map(([v, label]) =>
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(v === current),
            onclick: () => onPick(v),
          },
          label,
        ),
      ),
    );
  }

  function viewTalk() {
    const pack = packById(state.packId);
    return [
      h(
        "section",
        { class: "stack" },
        h("p", { class: "eyebrow" }, "Parlare"),
        h("h1", {}, state.talkMode === "dialog" ? "Dialogo" : "Ripeti"),
        seg(
          [
            ["dialog", "Dialogo"],
            ["shadow", "Ripeti"],
          ],
          state.talkMode,
          (v) => {
            state.talkMode = v;
            render();
          },
        ),
        packPicker(() => {
          state.dlgRun = null;
          render();
        }),
      ),
      state.talkMode === "dialog" ? renderDialog(pack) : renderShadow(pack),
    ];
  }

  // Speech is opt-in, transient, and never sent to the progress backend.
  let activeRecognition = null;
  function stopListening() {
    const current = activeRecognition;
    activeRecognition = null;
    if (current) {
      current.onresult = current.onerror = current.onend = null;
      try {
        current.abort();
      } catch {}
    }
  }
  window.addEventListener("pagehide", stopListening);
  function spokenAnswer(onSubmit) {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const transcript = h("textarea", {
      rows: 2,
      "aria-label": "Your spoken Italian response",
      placeholder: "Your Italian response appears here. You can edit it.",
      style: "width:100%;box-sizing:border-box;font:inherit;padding:12px",
    });
    const status = h(
      "p",
      { class: "small muted", role: "status", "aria-live": "polite" },
      Recognition
        ? "Ready. Press the microphone, then speak Italian."
        : "Speech recognition is unavailable here. Try Chrome or Edge, or type your response below.",
    );
    const submit = h(
      "button",
      {
        class: "btn",
        type: "button",
        disabled: true,
        onclick: () => {
          stopListening();
          resetMic();
          onSubmit(transcript.value, status);
        },
      },
      "Check response",
    );
    transcript.addEventListener("input", () => {
      submit.disabled = !transcript.value.trim();
    });
    const mic = h(
      "button",
      {
        class: "btn primary",
        type: "button",
        disabled: !Recognition,
        "aria-pressed": "false",
      },
      "🎙 Speak response",
    );
    const resetMic = () => {
      mic.textContent = "🎙 Speak response";
      mic.setAttribute("aria-pressed", "false");
    };
    mic.addEventListener("click", () => {
      if (activeRecognition) {
        try {
          activeRecognition.stop();
        } catch {
          stopListening();
          resetMic();
        }
        return;
      }
      try {
        if (tts.ok) window.speechSynthesis.cancel();
        const recognition = new Recognition();
        activeRecognition = recognition;
        recognition.lang = "it-IT";
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        submit.disabled = true;
        recognition.onresult = (event) => {
          if (activeRecognition !== recognition) return;
          transcript.value = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join(" ");
          status.textContent =
            "Heard you. Review the text, then press Check response.";
        };
        recognition.onerror = (event) => {
          if (activeRecognition !== recognition) return;
          const errors = {
            "not-allowed":
              "Microphone access was denied. Allow it in your browser’s site settings, or type below.",
            "service-not-allowed":
              "Your browser’s speech service is unavailable. Try another supported browser or type below.",
            "audio-capture":
              "No microphone was found. Connect a microphone and try again.",
            "no-speech":
              "No speech was heard. Press the microphone to try again.",
            network:
              "Speech recognition could not connect. Check your connection and try again.",
            "language-not-supported":
              "Italian speech recognition is unavailable on this device. You can type below.",
          };
          status.textContent =
            errors[event.error] ||
            "Speech recognition stopped. Try again or type your response.";
        };
        recognition.onend = () => {
          if (activeRecognition !== recognition) return;
          activeRecognition = null;
          resetMic();
          submit.disabled = !transcript.value.trim();
          if (
            !transcript.value.trim() &&
            status.textContent === "Listening… Speak Italian, then pause."
          )
            status.textContent =
              "No response captured. Press the microphone to try again.";
        };
        status.textContent = "Listening… Speak Italian, then pause.";
        mic.textContent = "Stop listening";
        mic.setAttribute("aria-pressed", "true");
        recognition.start();
      } catch {
        stopListening();
        resetMic();
        submit.disabled = !transcript.value.trim();
        status.textContent =
          "Could not start the microphone. Try opening Italian Live in its own browser tab, or type below.";
      }
    });
    return h(
      "section",
      { class: "panel stack", "aria-label": "Speak your response" },
      h("h2", {}, "Say your response aloud"),
      h(
        "p",
        { class: "small muted" },
        "Choose a response below and say it in Italian. Your browser may send audio to its speech provider. Italian Live does not store audio or this draft. This checks the response text, not your pronunciation.",
      ),
      h("div", { class: "row", style: "flex-wrap:wrap;gap:12px" }, mic, submit),
      transcript,
      status,
    );
  }
  function normalizeSpeech(value) {
    return value
      .normalize("NFKC")
      .toLocaleLowerCase("it-IT")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function renderDialog(pack) {
    let run = state.dlgRun;
    if (!run || run.pack !== pack.id)
      run = state.dlgRun = {
        pack: pack.id,
        step: 0,
        misses: 0,
        wrong: {},
        firstTry: 0,
        history: [],
      };
    const steps = pack.dialogue.steps;
    const chat = h("div", { class: "chat" });
    chat.append(h("p", { class: "note" }, pack.dialogue.setting));
    for (const entry of run.history) {
      chat.append(themBubble(entry.npc, entry.npc_en));
      chat.append(
        h(
          "div",
          { class: "bubble me" },
          h("span", { class: "de" }, entry.answer),
        ),
      );
    }
    if (run.step < steps.length) {
      const st = steps[run.step];
      const autoplay = run.spoken !== run.step;
      run.spoken = run.step;
      chat.append(themBubble(st.npc, st.npc_en, autoplay));
      const wrong = run.wrong;
      const opts = shuffleSeeded(st.options, pack.id + run.step);
      const answer = (o) => {
        window.LLAnalytics?.track("learning_started");
        if (wrong[o.de]) return;
        if (o.ok) {
          if (Object.keys(wrong).length === 0) run.firstTry += 1;
          run.history.push({ npc: st.npc, npc_en: st.npc_en, answer: o.de });
          run.step += 1;
          run.wrong = {};
          tts.say(o.de);
          if (run.step === steps.length) finishDialog(pack, run);
        } else {
          wrong[o.de] = o.why;
          run.misses += 1;
        }
        render();
      };
      chat.append(
        spokenAnswer((text, status) => {
          const matches = opts.filter(
            (o) => normalizeSpeech(o.de) === normalizeSpeech(text),
          );
          if (matches.length !== 1) {
            status.textContent =
              "This exercise checks the listed responses. Say one of them, edit the transcript, or select it below. Other valid phrasings are not graded. Your score has not changed.";
            return;
          }
          if (wrong[matches[0].de]) {
            status.textContent =
              "You have already tried that response. Try a different one.";
            return;
          }
          answer(matches[0]);
        }),
      );
      const optionsEl = h(
        "div",
        { class: "options", role: "group", "aria-label": "Your answer" },
        opts.map((o) =>
          h(
            "button",
            {
              class: "option" + (wrong[o.de] ? " wrong" : ""),
              type: "button",
              disabled: !!wrong[o.de],
              onclick: () => answer(o),
            },
            o.de,
          ),
        ),
      );
      chat.append(optionsEl);
      for (const why of Object.values(wrong))
        chat.append(h("div", { class: "corr" }, why));
    } else {
      chat.append(
        h(
          "section",
          { class: "panel" },
          h("h2", {}, `${run.firstTry} / ${steps.length} right first time`),
          h(
            "p",
            { class: "muted" },
            run.firstTry === steps.length
              ? "Perfetto. Now try the same scene freely with the AI tutor."
              : "Run it again until every answer is right first time.",
          ),
          h(
            "div",
            { class: "row" },
            h(
              "button",
              {
                class: "btn",
                type: "button",
                onclick: () => {
                  state.dlgRun = null;
                  render();
                },
              },
              "Again",
            ),
            h(
              "button",
              {
                class: "btn primary",
                type: "button",
                onclick: () => {
                  state.chat = null;
                  state.tutorScene = pack.id;
                  go("tutor", "chat");
                },
              },
              "Practise with the tutor",
            ),
          ),
        ),
      );
    }
    return chat;
  }
  function finishDialog(pack, run) {
    const prev = store.state.dlg[pack.id] || { best: 0 };
    store.state.dlg[pack.id] = {
      best: Math.max(prev.best || 0, run.firstTry),
      last: today(),
    };
    logToday("dialogs");
    store.state.play = DLPlayCore.award(
      store.state.play,
      today(),
      store.state.log,
    );
    store.change();
  }
  function themBubble(de, en, autoplay) {
    const tr = h("span", { class: "tr", hidden: true }, en);
    if (autoplay) setTimeout(() => tts.say(de), 80);
    return h(
      "div",
      { class: "bubble them" },
      h("span", { class: "de" }, de),
      tr,
      h(
        "div",
        { class: "bubble-tools" },
        speakBtn(de, { small: true }),
        en
          ? h(
              "button",
              {
                class: "linkish",
                type: "button",
                onclick: (e) => {
                  tr.hidden = !tr.hidden;
                  e.currentTarget.textContent = tr.hidden
                    ? "Translate"
                    : "Hide";
                },
              },
              "Translate",
            )
          : null,
      ),
    );
  }

  function renderShadow(pack) {
    const sentences = pack.items
      .filter((i) => i.ex)
      .map((i) => ({ de: i.ex, en: i.ex_en }));
    const done = (store.state.log[today()] || {}).shadow || 0;
    return h(
      "section",
      { class: "stack" },
      h(
        "p",
        { class: "note" },
        tts.ok
          ? "Play a sentence, then say it out loud at the same speed, twice. Reveal the text only to check yourself. Tap Done for each sentence."
          : "This browser has no Italian voice. Read each sentence aloud instead, then check the translation.",
      ),
      h("p", { class: "small muted num" }, `${done} sentences today · goal 10`),
      h(
        "ol",
        { class: "stack", style: "list-style:none;padding:0;margin:0" },
        sentences.map((s, idx) => {
          const text = h("span", { class: "de", hidden: tts.ok }, s.de);
          const tr = h("span", { class: "tr small muted", hidden: true }, s.en);
          return h(
            "li",
            { class: "panel" },
            h(
              "div",
              { class: "row" },
              speakBtn(s.de, { label: "Play sentence" }),
              speakBtn(s.de, { rate: 0.7, label: "Play slowly" }),
              h("span", { class: "small muted num" }, `Frase ${idx + 1}`),
            ),
            text,
            tr,
            h(
              "div",
              { class: "row" },
              h(
                "button",
                {
                  class: "linkish",
                  type: "button",
                  onclick: () => {
                    text.hidden = false;
                    tr.hidden = false;
                  },
                },
                "Show text",
              ),
              h(
                "button",
                {
                  class: "btn",
                  type: "button",
                  style: "margin-left:auto",
                  onclick: (e) => {
                    logToday("shadow");
                    store.change();
                    e.currentTarget.disabled = true;
                    e.currentTarget.textContent = "Done ✓";
                  },
                },
                "Done",
              ),
            ),
          );
        }),
      ),
    );
  }

  // ---------- TUTOR (AI role-play + writing) ----------
  function viewTutor() {
    return [
      h(
        "section",
        { class: "stack" },
        h("p", { class: "eyebrow" }, "KI-Tutor"),
        h("h1", {}, state.tutorMode === "chat" ? "Conversazione" : "Scrivere"),
        seg(
          [
            ["chat", "Conversazione"],
            ["write", "Scrivere"],
          ],
          state.tutorMode,
          (v) => {
            state.tutorMode = v;
            render();
          },
        ),
      ),
      !ai.ready
        ? h("p", { class: "muted" }, "Preparing practice …")
        : !ai.available()
          ? renderExternalPractice()
          : state.tutorMode === "chat"
            ? renderChat()
            : renderWriting(),
    ];
  }

  function renderExternalPractice() {
    const sceneId = state.tutorScene || currentSituation().id;
    const scene = sceneFor(sceneId);
    const picker = h(
      "select",
      { "aria-label": "Role-play situation" },
      h(
        "option",
        { value: "free", selected: sceneId === "free" },
        "Free conversation",
      ),
      SITUATIONS.map((p) =>
        h(
          "option",
          { value: p.id, selected: p.id === sceneId },
          p.title + " · " + p.title_en,
        ),
      ),
    );
    picker.addEventListener("change", () => {
      state.tutorScene = picker.value;
      render();
    });
    const prompt =
      state.tutorMode === "write"
        ? `You are my Italian writing tutor. My level is ${scene.level}. Give me a short writing task about this situation: ${scene.text} Wait for my answer, then correct it, explain the three most useful improvements in English, and ask me to try again. Do not ask for real personal information; use fictional details.`
        : `You are my Italian conversation partner. My level is ${scene.level}. Role-play this situation: ${scene.text} Play the other person. Speak mostly Italian at my level, one short turn at a time, and wait for my reply. After each reply give one brief correction if needed, then continue naturally. Explain in English only when I ask or seem stuck. Use fictional personal details. Begin the conversation now. If I use voice mode, keep your turns short.`;
    const text = h(
      "textarea",
      {
        "aria-label": "Practice prompt",
        readonly: true,
        rows: 7,
        style: "width:100%;box-sizing:border-box;font:inherit;padding:12px",
      },
      prompt,
    );
    return h(
      "section",
      { class: "stack" },
      picker,
      h(
        "div",
        { class: "panel" },
        h("h2", {}, "Practise with your own AI account"),
        h(
          "p",
          {},
          "Copy this scenario, open ChatGPT or Claude, and paste it into a new conversation. You can use voice mode there if your account supports it.",
        ),
        h(
          "p",
          { class: "small muted" },
          "Practice opens in the other app. Its account limits apply. Conversations and corrections are not automatically saved back to Italian Live. Embedded AI is not connected yet.",
        ),
        text,
        h(
          "div",
          { class: "row", style: "flex-wrap:wrap;gap:12px" },
          h(
            "button",
            {
              class: "btn primary",
              type: "button",
              onclick: async () => {
                try {
                  await navigator.clipboard.writeText(prompt);
                  toast("Scenario copied. Paste it into your AI chat.");
                } catch {
                  text.focus();
                  text.select();
                  toast("Select and copy the scenario above.");
                }
              },
            },
            "Copy scenario",
          ),
          h(
            "a",
            {
              class: "btn",
              href: "https://chatgpt.com/",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "Open ChatGPT",
          ),
          h(
            "a",
            {
              class: "btn",
              href: "https://claude.ai/",
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "Open Claude",
          ),
        ),
      ),
    );
  }

  /** The learner's level today, from the 26-week plan. */
  function currentLevel() {
    return C.phaseFor(C.weekOf(store.state.settings.start, today())).level;
  }

  function sceneFor(id) {
    if (id === "free")
      return {
        id,
        title: "Conversazione libera",
        level: currentLevel(),
        text: "Small talk with a friendly neighbour about your day, your work and your weekend.",
      };
    const p = packById(id);
    return {
      id: p.id,
      title: p.title,
      level: p.level,
      text: p.dialogue.setting,
    };
  }

  function renderChat() {
    const sceneId = state.tutorScene || currentSituation().id;
    const scene = sceneFor(sceneId);
    const chat = state.chat;
    const picker = h(
      "select",
      { id: "scene-pick", "aria-label": "Scene" },
      [
        h(
          "option",
          { value: "free", selected: sceneId === "free" },
          "Conversazione libera · free small talk",
        ),
      ].concat(
        SITUATIONS.map((p) =>
          h(
            "option",
            { value: p.id, selected: p.id === sceneId },
            `${p.title} · ${p.title_en}`,
          ),
        ),
      ),
    );
    picker.addEventListener("change", () => {
      state.tutorScene = picker.value;
      state.chat = null;
      render();
    });

    if (!chat || chat.scene !== scene.id) {
      return h(
        "section",
        { class: "stack" },
        picker,
        h(
          "div",
          { class: "panel" },
          h("b", {}, scene.title),
          h("p", { class: "muted" }, scene.text),
          h(
            "p",
            { class: "small muted" },
            "The tutor plays the other person, answers at your level and corrects each message. Every correction is saved as a card.",
          ),
          h(
            "button",
            {
              class: "btn primary",
              type: "button",
              onclick: () => startChat(scene),
            },
            "Start conversation",
          ),
        ),
      );
    }

    const list = h("div", { class: "chat", "aria-live": "polite" });
    for (const m of chat.view) {
      if (m.role === "them") list.append(themBubble(m.de, m.en));
      else {
        list.append(
          h("div", { class: "bubble me" }, h("span", { class: "de" }, m.de)),
        );
        if (m.corrections) {
          if (!m.corrections.length)
            list.append(h("div", { class: "corr ok" }, "Correct!"));
          for (const c of m.corrections)
            list.append(
              h(
                "div",
                { class: "corr" },
                h("span", {}, h("s", {}, c.wrong), " → ", h("b", {}, c.right)),
                c.rule ? h("span", { class: "small" }, c.rule) : null,
              ),
            );
        }
      }
    }
    if (chat.busy)
      list.append(
        h("p", { class: "thinking" }, chat.partial ? "…" : "Thinking …"),
      );
    if (chat.error) list.append(h("p", { class: "note" }, chat.error));

    const box = h("textarea", {
      id: "chat-input",
      lang: "it",
      placeholder: "Rispondi in italiano …",
      "aria-label": "Your message in Italian",
      disabled: chat.busy,
    });
    box.value = chat.draft || "";
    box.addEventListener("input", () => {
      chat.draft = box.value;
    });
    box.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        window.matchMedia("(hover: hover)").matches
      ) {
        e.preventDefault();
        sendChat(box.value);
      }
    });
    setTimeout(() => {
      if (!chat.busy) box.focus();
      list.lastElementChild?.scrollIntoView({ block: "nearest" });
    }, 30);
    return [
      h("section", { class: "stack" }, picker, list),
      h(
        "div",
        { class: "composer" },
        box,
        h(
          "div",
          { class: "row" },
          chat.busy
            ? h(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onclick: () => chat.ctl && chat.ctl.abort(),
                },
                "Stop",
              )
            : h(
                "button",
                {
                  class: "btn primary",
                  type: "button",
                  onclick: () => sendChat(box.value),
                },
                "Send",
              ),
          h(
            "button",
            {
              class: "linkish",
              type: "button",
              onclick: () => {
                state.chat = null;
                render();
              },
            },
            "New conversation",
          ),
          h(
            "span",
            { class: "small muted" },
            "Tip: use the mic on your keyboard to speak.",
          ),
        ),
      ),
    ];
  }

  async function startChat(scene) {
    state.chat = {
      scene: scene.id,
      rules: C.tutorRules(scene.text, scene.level),
      turns: [],
      view: [],
      busy: false,
      draft: "",
    };
    await askTutor();
  }

  async function sendChat(text) {
    const chat = state.chat;
    const msg = (text || "").trim();
    if (!chat || chat.busy || !msg) return;
    chat.turns.push({ role: "user", content: msg });
    chat.view.push({ role: "me", de: msg });
    chat.draft = "";
    logToday("turns");
    store.change();
    await askTutor();
  }

  async function askTutor() {
    const chat = state.chat;
    chat.busy = true;
    chat.error = null;
    chat.ctl = new AbortController();
    render();
    const recent = chat.turns.slice(-16);
    while (recent.length && recent[0].role !== "user") recent.shift();
    const input = [{ role: "user", content: chat.rules }].concat(recent);
    try {
      const raw = await ai.fn.json(input, {
        cache: false,
        modelTier: "quick",
        signal: chat.ctl.signal,
      });
      const r = C.parseTutorReply(raw);
      chat.turns.push({ role: "assistant", content: JSON.stringify(raw) });
      const lastMine = [...chat.view].reverse().find((m) => m.role === "me");
      if (lastMine && !lastMine.corrections) {
        lastMine.corrections = r.corrections;
        saveCorrections(r.corrections);
      }
      chat.view.push({ role: "them", de: r.reply, en: r.reply_en });
      tts.say(r.reply);
    } catch (e) {
      if (!(e && e.code === "cancelled")) chat.error = ai.message(e && e.code);
      // an unanswered user turn stays; the next message is read together with it
    } finally {
      chat.busy = false;
      if (state.chat === chat) render();
    }
  }

  function saveCorrections(list) {
    let added = 0;
    for (const c of list) {
      const id = C.customId(c.right);
      if (store.state.custom[id]) continue;
      store.state.custom[id] = C.correctionToItem(c);
      store.state.cards[id] = C.newCard(today());
      added += 1;
    }
    if (added) {
      store.change();
      toast(`${added} correction${added > 1 ? "s" : ""} saved as cards`);
    }
  }

  function renderWriting() {
    const pack = packById(state.packId);
    const task = `Write 5 to 8 sentences about this situation: ${pack.title_en}. ${pack.dialogue.setting}`;
    const w =
      state.writing && state.writing.pack === pack.id
        ? state.writing
        : (state.writing = {
            pack: pack.id,
            text: "",
            busy: false,
            result: null,
            error: null,
          });
    const box = h("textarea", {
      id: "write-input",
      lang: "it",
      placeholder: "Scrivi qui …",
      "aria-label": "Your text in Italian",
      disabled: w.busy,
      style: "min-height:180px",
    });
    box.value = w.text;
    box.addEventListener("input", () => {
      w.text = box.value;
    });
    const submit = async () => {
      const text = w.text.trim();
      if (text.length < 20 || w.busy) {
        if (text.length < 20) toast("Write at least two sentences first.");
        return;
      }
      w.busy = true;
      w.error = null;
      w.ctl = new AbortController();
      render();
      try {
        const raw = await ai.fn.json(C.writingPrompt(task, pack.level, text), {
          cache: false,
          signal: w.ctl.signal,
        });
        w.result = {
          corrected: String(raw.corrected || ""),
          better: String(raw.better || ""),
          score: Number(raw.score) || null,
          corrections: C.cleanCorrections(raw.corrections),
        };
        saveCorrections(w.result.corrections);
        logToday("writes");
        store.change();
      } catch (e) {
        if (!(e && e.code === "cancelled")) w.error = ai.message(e && e.code);
      } finally {
        w.busy = false;
        render();
      }
    };
    const res = w.result;
    return h(
      "section",
      { class: "stack" },
      packPicker(() => render()),
      h("div", { class: "panel" }, h("b", {}, "Compito"), h("p", {}, task)),
      box,
      h(
        "div",
        { class: "row" },
        w.busy
          ? h(
              "button",
              {
                class: "btn",
                type: "button",
                onclick: () => w.ctl && w.ctl.abort(),
              },
              "Stop",
            )
          : h(
              "button",
              { class: "btn primary", type: "button", onclick: submit },
              "Correct my text",
            ),
        w.busy ? h("span", { class: "thinking" }, "Reading your text …") : null,
      ),
      w.error ? h("p", { class: "note" }, w.error) : null,
      res
        ? h(
            "div",
            { class: "panel" },
            res.score
              ? h("p", { class: "eyebrow num" }, `Score ${res.score} / 5`)
              : null,
            h("h3", {}, "Corrected"),
            h("p", { class: "de", style: "font-size:18px" }, res.corrected),
            res.corrections.length
              ? h(
                  "div",
                  { class: "stack" },
                  res.corrections.map((c) =>
                    h(
                      "div",
                      {
                        class: "corr",
                        style: "align-self:stretch;max-width:none",
                      },
                      h(
                        "span",
                        {},
                        h("s", {}, c.wrong),
                        " → ",
                        h("b", {}, c.right),
                      ),
                      c.rule ? h("span", { class: "small" }, c.rule) : null,
                    ),
                  ),
                )
              : h("div", { class: "corr ok" }, "No mistakes. Sehr gut!"),
            h("h3", {}, "One level up"),
            h("p", { class: "de", style: "font-size:18px" }, res.better),
          )
        : null,
    );
  }

  // ---------- PROGRESS ----------
  function viewProgress() {
    const d = today();
    const s = store.state.settings;
    const st = C.stats(store.state.cards, store.state.log, d);
    const week = C.weekOf(s.start, d);
    return [
      h(
        "section",
        { class: "stack" },
        h("p", { class: "eyebrow" }, "Progressi"),
        h("h1", {}, `Week ${week} of 26`),
        h(
          "p",
          { class: "muted" },
          `${C.phaseFor(week).level} phase · target by end of this week: ${C.targetWords(week)} words`,
        ),
      ),
      h(
        "section",
        { class: "tiles" },
        tile(st.learned, "words learned"),
        tile(st.mature, "known for 3+ weeks"),
        tile(st.streak, "day streak"),
        tile(st.due, "due today"),
      ),
      h(
        "section",
        { class: "panel chart" },
        h("h3", {}, "Reviews, last 14 days"),
        reviewsChart(st.last14),
      ),
      h(
        "section",
        { class: "panel" },
        h("h3", {}, "Packs"),
        h(
          "div",
          { class: "table-wrap" },
          h(
            "table",
            {},
            h(
              "thead",
              {},
              h(
                "tr",
                {},
                h("th", {}, "Situation"),
                h("th", { class: "n" }, "Words"),
                h("th", { class: "n" }, "Dialogue best"),
              ),
            ),
            h(
              "tbody",
              {},
              SITUATIONS.map((p) => {
                const best = store.state.dlg[p.id];
                return h(
                  "tr",
                  {},
                  h("td", {}, `${p.title} (${p.level})`),
                  h(
                    "td",
                    { class: "n" },
                    `${learnedIn(p.items)}/${p.items.length}`,
                  ),
                  h(
                    "td",
                    { class: "n" },
                    best ? `${best.best}/${p.dialogue.steps.length}` : "–",
                  ),
                );
              }),
              LEVELS.map((level) => {
                const items = CONTENT.packs
                  .filter((p) => p.level === level && p.kind === "core")
                  .flatMap((p) => p.items);
                return items.length
                  ? h(
                      "tr",
                      {},
                      h("td", {}, `Kernwortschatz ${level}`),
                      h(
                        "td",
                        { class: "n" },
                        `${learnedIn(items)}/${items.length}`,
                      ),
                      h("td", { class: "n" }, "–"),
                    )
                  : null;
              }),
            ),
          ),
        ),
      ),
      settingsPanel(),
      h(
        "p",
        { class: "small muted" },
        "Word meanings, articles, plurals and many example sentences come from ",
        h(
          "a",
          {
            href: "https://en.wiktionary.org/",
            target: "_blank",
            rel: "noopener",
          },
          "Wiktionary",
        ),
        " (via kaikki.org), licensed ",
        h(
          "a",
          {
            href: "https://creativecommons.org/licenses/by-sa/4.0/",
            target: "_blank",
            rel: "noopener",
          },
          "CC BY-SA 4.0",
        ),
        ". Word ranking: OpenSubtitles frequency list by Hermit Dave (CC BY-SA 4.0).",
      ),
    ];
  }
  function tile(n, label) {
    return h(
      "div",
      { class: "tile" },
      h("b", {}, String(n)),
      h("span", {}, label),
    );
  }

  function reviewsChart(days) {
    const W = 560,
      H = 160,
      padL = 28,
      padB = 22,
      padT = 10;
    const max = Math.max(10, ...days.map((x) => x.reviews));
    const step = Math.ceil(max / 2 / 5) * 5 || 5;
    const top = step * 2;
    const bw = (W - padL) / days.length;
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      "Bar chart of reviews per day over the last 14 days",
    );
    const add = (tag, attrs, text) => {
      const el = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      if (text != null) el.textContent = text;
      svg.append(el);
      return el;
    };
    for (const v of [0, step, top]) {
      add("line", {
        x1: padL,
        x2: W,
        y1: y(v),
        y2: y(v),
        stroke: "var(--line)",
        "stroke-width": 1,
      });
      add(
        "text",
        {
          x: padL - 6,
          y: y(v) + 4,
          "text-anchor": "end",
          "font-size": 11,
          fill: "var(--muted)",
        },
        String(v),
      );
    }
    days.forEach((dd, i) => {
      const x = padL + i * bw + bw * 0.18;
      const isToday = i === days.length - 1;
      if (dd.reviews > 0)
        add("rect", {
          x,
          y: y(dd.reviews),
          width: bw * 0.64,
          height: y(0) - y(dd.reviews),
          rx: 3,
          fill: isToday ? "var(--signal)" : "var(--ink)",
        });
      if (i % 2 === 1 || isToday)
        add(
          "text",
          {
            x: x + bw * 0.32,
            y: H - 6,
            "text-anchor": "middle",
            "font-size": 11,
            fill: isToday ? "var(--ink)" : "var(--muted)",
          },
          isToday ? "heute" : dd.day.slice(8),
        );
    });
    return svg;
  }

  function settingsPanel() {
    const s = store.state.settings;
    const start = h("input", { id: "set-start", type: "date", value: s.start });
    const minutes = h(
      "select",
      { id: "set-min" },
      [60, 90, 120, 150, 210, 240].map((m) =>
        h(
          "option",
          { value: m, selected: m === s.minutes },
          `${m} min (${(m / 60).toFixed(1).replace(".0", "")} h)`,
        ),
      ),
    );
    const perDay = h(
      "select",
      { id: "set-new" },
      [10, 15, 20, 25, 30, 40].map((n) =>
        h(
          "option",
          { value: n, selected: n === s.newPerDay },
          `${n} new words`,
        ),
      ),
    );
    const save = () => {
      if (start.value) s.start = start.value;
      s.minutes = Number(minutes.value);
      s.newPerDay = Number(perDay.value);
      store.change();
      toast("Settings saved");
      render();
    };
    for (const el of [start, minutes, perDay])
      el.addEventListener("change", save);
    const confirmRow = h(
      "div",
      { class: "confirm", hidden: true },
      h("span", { class: "small" }, "Delete all progress on every device?"),
      h(
        "button",
        {
          class: "btn",
          type: "button",
          style: "border-color:var(--bad);color:var(--bad)",
          onclick: () => {
            store.state = emptyState();
            store.change();
            store.save(true);
            state.session = null;
            toast("Progress reset");
            render();
          },
        },
        "Yes, reset",
      ),
      h(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            confirmRow.hidden = true;
          },
        },
        "Cancel",
      ),
    );
    return h(
      "section",
      { class: "panel" },
      h("h3", {}, "Settings"),
      h(
        "div",
        { class: "form-grid" },
        h("label", { for: "set-start" }, "Start date (week 1)", start),
        h("label", { for: "set-min" }, "Study time per day", minutes),
        h("label", { for: "set-new" }, "New words per day", perDay),
      ),
      h(
        "p",
        { class: "small muted" },
        tts.ok
          ? tts.voice
            ? `Voice: ${tts.voice.name}`
            : "Voice: browser default (no Italian voice found, install one in your phone's speech settings)."
          : "This browser can't play speech.",
      ),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "linkish",
            type: "button",
            onclick: () => {
              confirmRow.hidden = false;
            },
          },
          "Reset progress …",
        ),
      ),
      confirmRow,
    );
  }

  let accountUser = null,
    accountContent = null;
  function accountBar(user) {
    accountUser = user;
    const bar = h("div", { class: "menu-account-actions" });
    bar.append(
      user
        ? h(
            "button",
            {
              type: "button",
              onclick: async () => {
                try {
                  await store.save();
                  await window.DLAuth.signOut();
                } catch {
                  toast("Could not sign out. Please retry.");
                }
              },
            },
            "Sign out",
          )
        : h("a", { href: "/login" }, "Sign in"),
    );
    if (!user) {
      accountContent = bar;
      return;
    }
    bar.append(
      h(
        "button",
        {
          type: "button",
          onclick: () => {
            const blob = new Blob([JSON.stringify(toDocs(store.state))], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = h("a", {
              href: url,
              download: "italian-live-progress.json",
            });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          },
        },
        "Export progress",
      ),
    );
    const input = h("input", {
      type: "file",
      accept: ".json,application/json",
      "aria-label": "Import progress",
      hidden: true,
      onchange: async () => {
        try {
          const file = input.files[0];
          if (!file || file.size > 2000000)
            throw new Error("Choose a progress JSON file under 2 MB.");
          const docs = JSON.parse(await file.text());
          if (docs.meta?.v !== 1 || !docs.meta.settings || !docs.custom?.items)
            throw new Error("Invalid progress file");
          if (
            !confirm(
              "Replace current progress with this file? Export a backup first.",
            )
          )
            return;
          store.state = fromDocs(docs);
          store.change();
          await store.save(true);
          render();
        } catch (e) {
          toast(e.message);
        } finally {
          input.value = "";
        }
      },
    });
    bar.append(
      input,
      h(
        "button",
        { type: "button", onclick: () => input.click() },
        "Import progress",
      ),
    );
    accountContent = bar;
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const r = await fetch("/api/kids", { cache: "no-store" });
      if (r.ok) {
        location.replace("/kids.html");
        return;
      }
    } catch {}
    const hash = (location.hash || "").slice(1);
    if (
      [
        "today",
        "play",
        "reading",
        "cards",
        "talk",
        "tutor",
        "articles",
        "english",
        "progress",
        "shop",
      ].includes(hash)
    )
      state.view = hash;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") store.save();
    });
    await store.init();
    await DLRewardClient.init(window.DLUser).catch((e) => toast(e.message));
    DLRewardClient.subscribe((w) =>
      LLNavigation.updateCoins(DLRewardCore.balance(w)),
    );
    render();
    ai.init();
  }
  window.addEventListener("online", () => {
    if (window.DLUser && store.remote) store.save();
  });
  await boot().catch(() =>
    window.DLContent.showError(document, () => location.reload()),
  );
})();
