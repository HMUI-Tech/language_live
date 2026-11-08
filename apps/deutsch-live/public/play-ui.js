/* Presentation adapter. Progress belongs to the existing account/guest store. */
window.DLPlayUI = {
  create({
    h,
    today,
    getProgress,
    getLog,
    onChange,
    speak,
    onActivity,
    navigate,
    kids = false,
    onEvent = () => {},
    onMistake = () => {},
  }) {
    const C = window.DLPlayCore,
      root = h("section", { class: "play-zone stack" });
    let mode = "home",
      serial = 0,
      words = [],
      right = [],
      leftChoice = null,
      rightChoice = null,
      matched = new Set(),
      index = 0,
      solved = false,
      feedback = "",
      earnedNotice = "";
    const progress = () => C.award(getProgress(), today(), getLog());
    const button = (text, action, extra = {}) =>
      h(
        "button",
        { type: "button", class: "btn", onclick: action, ...extra },
        text,
      );
    function save(kind, id) {
      const before = progress();
      const next = C.record(before, today(), kind, id, getLog());
      onChange(next);
      onEvent(kind, id);
      const fresh = C.BADGES.filter(
        (b) => next.earned[b.id] && !before.earned[b.id],
      );
      if (fresh.length)
        earnedNotice = fresh.map((b) => b.en + " unlocked!").join(" ");
      onActivity();
    }
    function begin(which) {
      mode = which;
      words = C.round(today() + ":" + ++serial);
      right = C.shuffled(words, today() + ":right:" + serial);
      leftChoice = null;
      rightChoice = null;
      matched = new Set();
      index = 0;
      solved = false;
      feedback = "";
      earnedNotice = "";
      paint();
    }
    function choose(side, id) {
      if (matched.has(id)) return;
      feedback = "";
      earnedNotice = "";
      if (side === "left") leftChoice = id;
      else rightChoice = id;
      if (leftChoice && rightChoice) {
        if (leftChoice === rightChoice) {
          matched.add(id);
          save("match", id);
          feedback =
            "A match! " +
            words.find((w) => w.id === id).article +
            " " +
            words.find((w) => w.id === id).word +
            " = " +
            words.find((w) => w.id === id).en +
            ".";
        } else {
          onMistake(leftChoice);
          feedback =
            "Those two do not match yet. Try another pair - you keep your progress.";
        }
        leftChoice = null;
        rightChoice = null;
      }
      paint();
    }
    function rewards(p) {
      return h(
        "div",
        { class: "play-badges" },
        C.BADGES.map((b) =>
          h(
            "article",
            { class: "panel " + (p.earned[b.id] ? "badge-earned" : "") },
            h(
              "span",
              { class: "badge-symbol", "aria-hidden": "true" },
              b.emoji,
            ),
            h("h3", {}, b.en),
            h("p", { class: "de", lang: "de" }, b.title),
            h("p", { class: "small" }, b.description),
            h(
              "p",
              { class: "small muted" },
              p.earned[b.id] ? "Earned " + p.earned[b.id] : "Not earned yet",
            ),
            h("p", {}, "Free reward: " + b.reward),
            p.earned[b.id]
              ? h(
                  "div",
                  { class: "row" },
                  h(
                    "a",
                    {
                      class: "btn primary",
                      href: "/rewards/" + b.resource,
                      download: b.resource,
                    },
                    "Download practice PDF",
                  ),
                  h(
                    "a",
                    {
                      href: "/rewards/" + b.resource,
                      target: "_blank",
                      rel: "noopener",
                    },
                    "Open to print",
                  ),
                )
              : h(
                  "p",
                  { class: "small muted" },
                  "This practice pack appears here when you earn the badge.",
                ),
          ),
        ),
      );
    }
    function paint() {
      const p = progress();
      const head = h(
        "header",
        { class: "stack" },
        h("p", { class: "eyebrow" }, "SPIELEN · PLAY & LEARN"),
        h("h1", {}, "Small quests. Real progress."),
        h(
          "p",
          {},
          "Explore everyday German with short, untimed games. Mistakes are part of learning.",
        ),
      );
      const nav = h(
        "div",
        {
          class: "row play-modes",
          role: "group",
          "aria-label": "Play sections",
        },
        ...["home", "match", "articles", "badges"].map((m) =>
          button(
            {
              home: "Quests",
              match: "Word match",
              articles: "Article challenge",
              badges: "Badges & rewards",
            }[m],
            () =>
              m === "match" || m === "articles"
                ? begin(m)
                : ((mode = m), paint()),
            { "aria-pressed": String(mode === m) },
          ),
        ),
      );
      const nodes = [
        head,
        nav,
        h(
          "p",
          { role: "status", "aria-live": "polite", class: "play-feedback" },
          earnedNotice || feedback,
        ),
      ];
      if (mode === "home") {
        const q = C.quests(p, today(), getLog()),
          done = q.filter((x) => x.value >= x.target).length;
        nodes.push(
          h(
            "div",
            { class: "panel" },
            h("h2", {}, "Today’s gentle quests"),
            h(
              "p",
              { class: "small muted" },
              `${done} of 3 complete · a fresh set each day. Your badges stay; no streak is lost.`,
            ),
            ...q.map((x) =>
              h(
                "div",
                { class: "play-quest" },
                h(
                  "div",
                  {},
                  h("b", {}, x.title),
                  h(
                    "p",
                    { class: "small muted" },
                    x.id === "lesson" && x.value === 5
                      ? "Complete"
                      : x.value + " / " + x.target,
                  ),
                ),
                h("progress", {
                  value: x.value,
                  max: x.target,
                  "aria-label": x.title,
                }),
                button(x.value >= x.target ? "Practise again" : "Start", () =>
                  x.mode === "lesson" ? navigate("cards") : begin(x.mode),
                ),
              ),
            ),
          ),
        );
        nodes.push(
          h(
            "div",
            { class: "tiles" },
            h(
              "div",
              { class: "panel" },
              h("h3", {}, "Words explored"),
              h(
                "b",
                { class: "play-number" },
                p.matches.length + " / " + C.WORDS.length,
              ),
              h(
                "p",
                { class: "small" },
                "Different words matched, not speed points.",
              ),
            ),
            h(
              "div",
              { class: "panel" },
              h("h3", {}, "Articles practised"),
              h(
                "b",
                { class: "play-number" },
                p.articles.length + " / " + C.WORDS.length,
              ),
              h(
                "p",
                { class: "small" },
                "Practise der, die and das without a timer.",
              ),
            ),
          ),
        );
        nodes.push(
          h(
            "div",
            { class: "note" },
            "Badges unlock free printable practice packs. They are personal milestones, not official language certificates. All regular lessons remain free.",
          ),
        );
      } else if (mode === "match") {
        nodes.push(
          h(
            "div",
            { class: "panel stack" },
            h("h2", {}, "Match words and meanings"),
            h(
              "p",
              {},
              "Choose a German word, then its English meaning. " +
                matched.size +
                " / " +
                words.length +
                " pairs found.",
            ),
            h(
              "div",
              { class: "play-match" },
              h(
                "div",
                { class: "stack" },
                h("h3", {}, "Deutsch"),
                ...words.map((w) =>
                  button(w.article + " " + w.word, () => choose("left", w.id), {
                    disabled: matched.has(w.id),
                    "aria-pressed": String(leftChoice === w.id),
                    class: "play-tile" + (matched.has(w.id) ? " matched" : ""),
                  }),
                ),
              ),
              h(
                "div",
                { class: "stack" },
                h("h3", {}, "English"),
                ...right.map((w) =>
                  button(w.en, () => choose("right", w.id), {
                    disabled: matched.has(w.id),
                    "aria-pressed": String(rightChoice === w.id),
                    class: "play-tile" + (matched.has(w.id) ? " matched" : ""),
                  }),
                ),
              ),
            ),
            matched.size === words.length
              ? h(
                  "div",
                  { class: "note stack" },
                  h("b", {}, "All six pairs found!"),
                  h(
                    "p",
                    {},
                    "Take a break, print a reward, or explore another set.",
                  ),
                  button("Another word set", () => begin("match")),
                )
              : null,
          ),
        );
      } else if (mode === "articles") {
        const w = words[index];
        nodes.push(
          h(
            "div",
            { class: "panel stack" },
            h(
              "p",
              { class: "small muted" },
              "Word " + (index + 1) + " of " + words.length,
            ),
            h("h2", {}, "Der, die oder das?"),
            h(
              "span",
              { class: "play-picture", "aria-hidden": "true" },
              w.emoji,
            ),
            h("p", { class: "play-word", lang: "de" }, w.word),
            h("p", { class: "muted" }, w.en),
            h(
              "div",
              {
                class: "row",
                role: "group",
                "aria-label": "Choose the article",
              },
              ...["der", "die", "das"].map((article) =>
                button(
                  article,
                  () => {
                    if (solved) return;
                    if (article === w.article) {
                      solved = true;
                      save("articles", w.id);
                      feedback =
                        "Correct: " +
                        w.article +
                        " " +
                        w.word +
                        ". Learn the article together with the word.";
                      speak(w.article + " " + w.word);
                    } else {
                      onMistake(w.id);
                      feedback =
                        "Good try. This word is " +
                        w.article +
                        " " +
                        w.word +
                        ". Choose " +
                        w.article +
                        " to practise it once more.";
                    }
                    paint();
                  },
                  {
                    disabled: solved,
                    class: "btn play-article art-" + article,
                  },
                ),
              ),
            ),
            button("Listen to the word", () =>
              speak((solved ? w.article + " " : "") + w.word),
            ),
            solved
              ? button(
                  index === words.length - 1 ? "Finish this set" : "Next word",
                  () => {
                    if (index === words.length - 1) {
                      mode = "home";
                      feedback = "Set complete. Well done!";
                    } else {
                      index++;
                      solved = false;
                      feedback = "";
                      earnedNotice = "";
                    }
                    paint();
                  },
                  { class: "btn primary" },
                )
              : null,
          ),
        );
      } else
        nodes.push(
          h(
            "p",
            {},
            C.BADGES.filter((b) => p.earned[b.id]).length +
              " of " +
              C.BADGES.length +
              " badges earned. No purchases, no points to spend.",
          ),
          rewards(p),
        );
      if (!kids)
        nodes.push(
          h(
            "p",
            { class: "small muted" },
            "Games use 36 selected everyday words. An adult can play alongside a child. For dedicated Kids mode and parent-managed profiles, open Family from the account bar. Guest badges last only until you leave or refresh; signed-in badges use your existing progress account.",
          ),
        );
      root.replaceChildren(...nodes);
    }
    paint();
    return root;
  },
};
