window.DLRewardUI = {
  companion(h, w, avatar = "🦊", kids = false) {
    const wear = w?.wear || {};
    return h(
      "div",
      {
        class: "reward-companion room-" + (wear.room || "plain"),
        "aria-label":
          "Your learning companion. It stays happy when you take a break.",
      },
      h(
        "span",
        { class: "companion-scene", "aria-hidden": "true" },
        wear.room === "garden"
          ? "🌳 🌼"
          : wear.room === "reading-room"
            ? "📚 💡"
            : "✨",
      ),
      h(
        "span",
        { class: "companion-animal", "aria-hidden": "true" },
        w?.avatar || avatar,
      ),
      h(
        "span",
        { class: "companion-outfit", "aria-hidden": "true" },
        wear.outfit
          ? DLRewardCore.CATALOG.find((x) => x.id === wear.outfit)?.icon || "👕"
          : "👕",
      ),
      h(
        "span",
        { class: "companion-estate" },
        ...(kids ? [] : ["property", "vehicle", "club"])
          .filter((k) => wear[k])
          .map((k) =>
            h(
              "span",
              {},
              DLRewardCore.CATALOG.find((x) => x.id === wear[k])?.icon || "",
            ),
          ),
      ),
      wear.hat
        ? h("span", { class: "companion-hat", "aria-hidden": "true" }, "🎩")
        : null,
      wear.glasses
        ? h("span", { class: "companion-glasses", "aria-hidden": "true" }, "👓")
        : null,
      wear.scarf
        ? h("span", { class: "companion-scarf", "aria-hidden": "true" }, "🧣")
        : null,
    );
  },
  create({
    h,
    getWallet,
    act,
    kids = false,
    guest = false,
    speak = () => {},
    avatar = "🦊",
    spendingEnabled = true,
  }) {
    const C = DLRewardCore,
      catalog = C.catalog(kids),
      words = DLPlayCore.WORDS,
      lang =
        typeof DLRewardLanguage !== "undefined"
          ? DLRewardLanguage
          : document.documentElement.lang === "it"
            ? "it"
            : "de",
      stories = DLRewardStories,
      root = h("section", { class: "rewards-zone stack" });
    let mode = "shop",
      busy = false,
      message = "",
      confirmItem = null,
      confirmCurrency = "coins",
      story = null,
      answers = {},
      checked = false,
      branch = "start",
      sheet = 0,
      practiceIndex = 0,
      practiceWords = [],
      practiceSolved = false,
      practiceFeedback = "";
    const wallet = () => C.normalize(getWallet()),
      phrase = (w) => w.article + (w.article.endsWith("'") ? "" : " ") + w.word;
    const button = (text, fn, extra = {}) =>
      h(
        "button",
        { type: "button", class: "btn", disabled: busy, onclick: fn, ...extra },
        text,
      );
    async function run(event, after) {
      if (busy) return;
      busy = true;
      message = "Saving…";
      paint();
      try {
        await act(event);
        message = "Saved ✓";
        if (after) after();
      } catch (e) {
        message = e.message;
      } finally {
        busy = false;
        paint();
      }
    }
    function open(id) {
      confirmItem = null;
      message = "";
      if (id === "bonus" || id === "journey") mode = id;
      else if (id === "branch") {
        mode = "branch";
        branch = "start";
      } else if (id === "print") {
        mode = "print";
        sheet++;
      } else if (id === "personal") {
        mode = "personal";
        const w = wallet();
        practiceWords = [...words]
          .sort(
            (a, b) =>
              (w.weak[b.id] || 0) - (w.weak[a.id] || 0) ||
              Number(w.recall.includes(a.id)) - Number(w.recall.includes(b.id)),
          )
          .slice(0, 5);
        practiceIndex = 0;
        practiceSolved = false;
        practiceFeedback = "";
      }
      paint();
    }
    function read(s) {
      story = s;
      answers = {};
      checked = false;
      mode = "story";
      message = "";
      paint();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function quiz(s) {
      return h(
        "div",
        { class: "stack" },
        h("p", { class: "eyebrow" }, s.level + " · BONUS READING"),
        h("h2", {}, s.title),
        h(
          "details",
          { class: "panel" },
          h("summary", {}, "Vocabulary help"),
          ...(s.words || []).map((w) =>
            h("p", {}, h("strong", { lang }, w.de), " — " + w.en),
          ),
        ),
        h(
          "article",
          { class: "panel reward-story", lang },
          ...s.sentences.map((t) => h("p", {}, t)),
        ),
        h(
          "div",
          { class: "row" },
          button("Listen", () => speak(s.sentences.join(" "))),
          button("Stop audio", () => window.speechSynthesis?.cancel()),
        ),
        ...s.questions.map((q, i) =>
          h(
            "fieldset",
            { class: "panel" },
            h("legend", { lang }, `${i + 1}. ${q.prompt}`),
            ...q.options.map((option, j) =>
              h(
                "label",
                { class: "reward-option" },
                h("input", {
                  type: "radio",
                  name: "reward-q-" + i,
                  checked: answers[i] === j,
                  disabled: checked,
                  onchange: () => {
                    answers[i] = j;
                  },
                }),
                h("span", { lang }, option),
              ),
            ),
            checked
              ? h(
                  "div",
                  { class: "note", lang },
                  (answers[i] === q.answer ? "✓ " : "→ ") + q.options[q.answer],
                  h("p", {}, q.explanation),
                )
              : null,
          ),
        ),
        checked
          ? h(
              "div",
              { class: "note" },
              `${s.questions.filter((q, i) => answers[i] === q.answer).length} / ${s.questions.length} correct. Your best result stays; retries are welcome.`,
              button("Read and try again", () => read(s)),
            )
          : button(
              "Check all answers",
              () => {
                if (s.questions.some((_, i) => answers[i] === undefined)) {
                  message = "Choose an answer for each question first.";
                  paint();
                  return;
                }
                run(
                  {
                    op: "event",
                    kind: "reading",
                    id: s.id,
                    answers: s.questions.map((_, i) => answers[i]),
                  },
                  () => {
                    checked = true;
                  },
                );
              },
              { class: "btn primary" },
            ),
      );
    }
    function printable() {
      const picked = DLPlayCore.shuffled(words, "print-" + sheet)
          .filter((w) => w.word.length <= 11)
          .slice(0, 6),
        size = 14,
        grid = Array.from({ length: size }, () => Array(size).fill("")),
        solution = [];
      let seed = sheet + 97;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed;
      };
      for (let i = 0; i < picked.length; i++) {
        const text = picked[i].word
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ß/g, "ss")
            .toUpperCase(),
          row = i * 2,
          col = rnd() % (size - text.length + 1);
        for (let j = 0; j < text.length; j++) grid[row][col + j] = text[j];
        solution.push(
          `${picked[i].word}: row ${row + 1}, column ${col + 1}, read →`,
        );
      }
      for (let i = 0; i < size; i++)
        for (let j = 0; j < size; j++)
          if (!grid[i][j]) grid[i][j] = String.fromCharCode(65 + (rnd() % 26));
      return h(
        "div",
        { class: "stack" },
        h(
          "div",
          { class: "row" },
          button("Print / save as PDF", () => window.print()),
          button("Another worksheet", () => {
            sheet++;
            paint();
          }),
        ),
        h(
          "section",
          { class: "reward-print panel" },
          h(
            "h2",
            {},
            lang === "it"
              ? "Il mio laboratorio di parole"
              : "Meine Wortwerkstatt",
          ),
          h(
            "p",
            {},
            "Name (optional): ____________________   Date: ______________",
          ),
          h("h3", {}, "1. Word search"),
          h(
            "p",
            {},
            "Find the six words below. All run from left to right; accents are omitted in the grid.",
          ),
          h(
            "pre",
            { class: "reward-grid", "aria-label": "Word search grid" },
            grid.map((r) => r.join(" ")).join("\n"),
          ),
          h("p", { lang }, picked.map(phrase).join(" · ")),
          h("h3", {}, "2. Match the words"),
          ...picked.map((w, i) => h("p", {}, `${i + 1}. ${phrase(w)} ____`)),
          h(
            "p",
            {},
            [...picked]
              .reverse()
              .map((w, i) => `${String.fromCharCode(65 + i)}. ${w.en}`)
              .join(" · "),
          ),
          h("h3", {}, "3. Add the article"),
          ...picked.map((w) => h("p", { lang }, "_______ " + w.word)),
          h(
            "section",
            { class: "reward-answer-sheet" },
            h("h3", {}, "Answer sheet"),
            ...solution.map((t) => h("p", {}, t)),
            h(
              "p",
              {},
              "Matching: " +
                picked
                  .map(
                    (_, i) =>
                      `${i + 1}-${String.fromCharCode(65 + picked.length - 1 - i)}`,
                  )
                  .join(", "),
            ),
            h("p", {}, "Articles: " + picked.map(phrase).join(", ")),
            h(
              "p",
              { class: "small" },
              "Original Language Live practice material. Free personal and classroom use.",
            ),
          ),
        ),
      );
    }
    function personal() {
      const w = practiceWords[practiceIndex],
        options = DLPlayCore.shuffled(
          [w, ...words.filter((x) => x.id !== w.id).slice(0, 2)],
          w.id + ":personal",
        );
      return h(
        "div",
        { class: "panel stack" },
        h("h2", {}, "My practice workshop"),
        h(
          "p",
          {},
          "Selected from words missed in word games first, then game words not yet recalled. Packs are assembled on your device; no external AI is used.",
        ),
        h("p", {}, `Word ${practiceIndex + 1} of ${practiceWords.length}`),
        h("span", { class: "reward-big", lang }, phrase(w)),
        button("Listen", () => speak(phrase(w))),
        h("p", {}, "Choose the English meaning."),
        h(
          "div",
          { class: "row" },
          ...options.map((choice) =>
            button(
              choice.en,
              () => {
                if (practiceSolved) return;
                if (choice.id === w.id)
                  run({ op: "event", kind: "recall", id: w.id }, () => {
                    practiceSolved = true;
                    practiceFeedback = "✓ " + phrase(w) + " = " + w.en;
                  });
                else
                  run({ op: "event", kind: "mistake", id: w.id }, () => {
                    practiceFeedback = "Try again: " + phrase(w) + " = " + w.en;
                  });
              },
              { disabled: busy || practiceSolved },
            ),
          ),
        ),
        h("p", { role: "status" }, practiceFeedback),
        practiceSolved
          ? button(
              practiceIndex === practiceWords.length - 1
                ? "Finish pack"
                : "Next word",
              () => {
                if (practiceIndex === practiceWords.length - 1) {
                  mode = "owned";
                  message =
                    "Practice pack complete. You can make another whenever you like.";
                } else {
                  practiceIndex++;
                  practiceSolved = false;
                  practiceFeedback = "";
                }
                paint();
              },
            )
          : null,
      );
    }
    let clubPanel = null,
      worldPanel = null;
    async function clubRequest(body) {
      const headers = await window.DLAuth.familyHeaders();
      const r = await fetch("/api/clubs", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Club unavailable.");
      return data;
    }
    async function openClub(id, phrase, adult = false) {
      if (busy) return;
      busy = true;
      try {
        const data = await clubRequest({
          club: id,
          adult,
          ...(phrase ? { phrase } : {}),
        });
        clubPanel = h(
          "div",
          { class: "panel stack" },
          h("h3", {}, "Member phrase board"),
          h(
            "p",
            {},
            "Posts expire after 30 days. Your generated member alias is shown, never your account name.",
          ),
          ...data.messages.map((m) => h("p", {}, m.alias + ": " + m.text)),
          h(
            "div",
            { class: "row" },
            ...data.phrases.map((p) => button(p, () => openClub(id, p))),
          ),
          button("Refresh board", () => openClub(id)),
        );
        message = "";
      } catch (e) {
        message = e.message;
        if (e.message.includes("18 or older"))
          clubPanel = h(
            "div",
            { class: "panel" },
            h(
              "p",
              {},
              "Shared boards are optional and for adults aged 18+. Your generated alias and selected phrases are visible to club members for up to 30 days.",
            ),
            button("I am 18+ · join shared board", () =>
              openClub(id, undefined, true),
            ),
          );
      } finally {
        busy = false;
        paint();
      }
    }
    function paint() {
      const w = wallet(),
        rating = C.rank(w),
        owned = catalog.filter((x) => w.owned.includes(x.id));
      const nodes = [
        h(
          "div",
          { class: "panel" },
          h("b", {}, "Today’s learning goal"),
          h(
            "p",
            {},
            Math.min(
              kids ? 10 : 20,
              w.daily.day ===
                new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Europe/Berlin",
                }).format(new Date())
                ? w.daily.ids.length
                : 0,
            ) +
              (kids
                ? " / 10 activities · +15 coins and 25 star points"
                : " / 20 activities · +5 coins and 25 star points"),
          ),
          h(
            "p",
            { class: "small" },
            kids
              ? "A gentle adventure: collect clothes, accessories and practice packs."
              : "Earn at most 20 coins per day. Luxury tiers double in price; coins come from learning, never messaging.",
          ),
        ),
        h(
          "header",
          { class: "stack" },
          h(
            "p",
            { class: "eyebrow" },
            (kids ? "KIDS REWARD SHOP · " : "16+ REWARDS & WORLD · ") +
              (lang === "it" ? "RICOMPENSE" : "BELOHNUNGEN"),
          ),
          h(
            "h1",
            {},
            kids
              ? "Learn, explore, collect!"
              : "Learn a language. Build your world.",
          ),
          h(
            "div",
            { class: "reward-wallet" },
            h("strong", {}, "🪙 " + C.balance(w) + " coins · ⭐ " + w.stars),
            h(
              "span",
              { class: "small" },
              `${w.earned} earned · ${w.spent} spent · ${owned.length} unlocked`,
            ),
          ),
          h(
            "p",
            {},
            "Free learning coins. No money value, trading or future crypto conversion. Coins never expire and rewards stay unlocked in your saved profile.",
          ),
          guest
            ? h(
                "p",
                { class: "note" },
                "Guest preview: coins and unlocks last only while this page stays open. Sign in, or ask a parent to start a saved child profile, for permanent rewards.",
              )
            : null,
        ),
        h(
          "div",
          { class: "row", role: "group", "aria-label": "Reward sections" },
          button("Shop", () => {
            mode = "shop";
            confirmItem = null;
            paint();
          }),
          button("My collection", () => {
            mode = "owned";
            paint();
          }),
          !kids
            ? button("My world · 16+", () => {
                mode = "world";
                worldPanel = DLWorldUI.create({ h, getWallet, guest });
                paint();
              })
            : null,
          button("How to earn", () => {
            mode = "earn";
            paint();
          }),
        ),
        h("p", { role: "status", "aria-live": "polite" }, message),
      ];
      nodes.push(
        h(
          "section",
          { class: "star-stages", "aria-label": "Reward stage progress" },
          ...C.STAGES.map((level, stage) =>
            h(
              "article",
              { class: "panel" },
              h("h2", {}, level),
              ...[0, 1, 2].map((i) => {
                const value = rating.percents[stage * 3 + i];
                return h(
                  "div",
                  { class: "star-progress" },
                  h("span", { "aria-hidden": "true" }, "★"),
                  h("progress", {
                    max: 100,
                    value,
                    "aria-label": level + " star " + (i + 1),
                  }),
                  h("span", {}, Math.floor(value) + "%"),
                );
              }),
            ),
          ),
        ),
        h(
          "p",
          { class: "small" },
          "Current reward stage: " +
            rating.level +
            " · " +
            rating.starsInLevel +
            "/3 stars. This is not a language-level assessment. Higher stars require more practice. Mistakes lose small amounts of progress, capped at 10 points per day; Kids mistakes cost nothing.",
        ),
      );
      if (!kids && !w.ageBand)
        nodes.push(
          h(
            "div",
            { class: "panel stack" },
            h("h2", {}, "Choose your age band"),
            h(
              "p",
              {},
              "The virtual world is for ages 16+. Your choice is saved to your account. Social spaces for 16–17 and 18+ are separate. This is a self-declaration, not identity verification. To correct a saved choice, contact the operator.",
            ),
            h(
              "div",
              { class: "row" },
              button("I am 16–17", () => run({ op: "age", band: "16-17" })),
              button("I am 18 or older", () => run({ op: "age", band: "18+" })),
              h(
                "a",
                { class: "btn", href: "/family.html" },
                "Under 16 · Kids & Family",
              ),
            ),
          ),
        );
      if (confirmItem) {
        const item = catalog.find((x) => x.id === confirmItem),
          payStars = confirmCurrency === "stars";
        let preview = null;
        if (payStars && w.stars >= item.starPrice)
          preview = C.rank(C.sacrifice(C.normalize(w), item.starPrice));
        nodes.push(
          h(
            "div",
            { class: "panel reward-confirm" },
            h("h2", {}, `Unlock ${item.title}?`),
            h(
              "p",
              {},
              payStars
                ? `${item.starPrice} completed stars will be sacrificed. ${rating.level} (${rating.completed} total stars) → ${preview?.level || rating.level} (${preview?.completed ?? rating.completed} total stars). Your language progress and existing items stay saved.`
                : `${item.price} coins · balance afterwards: ${C.balance(w) - item.price}. This is a permanent unlock.`,
            ),
            h(
              "div",
              { class: "row" },
              button(
                payStars
                  ? "Confirm: sacrifice " + item.starPrice + " stars"
                  : "Confirm: spend " + item.price + " coins",
                () =>
                  run(
                    { op: "buy", id: item.id, currency: confirmCurrency },
                    () => {
                      confirmItem = null;
                    },
                  ),
                { class: "btn primary" },
              ),
              button("Cancel", () => {
                confirmItem = null;
                paint();
              }),
            ),
          ),
        );
      }
      if (mode === "shop") {
        nodes.push(
          h(
            "div",
            { class: "reward-catalog" },
            ...catalog.map((item) => {
              const has = w.owned.includes(item.id);
              return h(
                "article",
                { class: "panel stack" },
                h(
                  "span",
                  { class: "reward-icon", "aria-hidden": "true" },
                  item.icon,
                ),
                h("h2", {}, item.title),
                h("p", {}, item.description),
                h("strong", {}, has ? "Unlocked ✓" : item.price + " coins"),
                has
                  ? button(
                      item.kind === "content"
                        ? "Open reward"
                        : item.kind === "social"
                          ? "Use in My world"
                          : "Wear / apply",
                      () =>
                        item.kind === "content"
                          ? open(item.id)
                          : item.kind === "social"
                            ? ((mode = "world"),
                              (worldPanel = DLWorldUI.create({
                                h,
                                getWallet,
                                guest,
                              })),
                              paint())
                            : run({
                                op: "equip",
                                id: item.id,
                                slot: item.kind,
                              }),
                    )
                  : button(
                      C.balance(w) < item.price
                        ? "Keep learning · " + item.price + " coins"
                        : "Unlock · " + item.price + " coins",
                      () => {
                        confirmItem = item.id;
                        confirmCurrency = "coins";
                        paint();
                      },
                      {
                        disabled:
                          busy || C.balance(w) < item.price || !spendingEnabled,
                        class: "btn primary",
                      },
                    ),
                !has
                  ? button(
                      "Sacrifice " + item.starPrice + " stars",
                      () => {
                        confirmItem = item.id;
                        confirmCurrency = "stars";
                        paint();
                      },
                      {
                        disabled:
                          busy || w.stars < item.starPrice || !spendingEnabled,
                      },
                    )
                  : null,
              );
            }),
          ),
        );
        if (!spendingEnabled)
          nodes.push(
            h(
              "p",
              { class: "note" },
              "A parent has paused coin spending for this profile. Your coins remain yours.",
            ),
          );
      } else if (mode === "owned") {
        nodes.push(
          DLRewardUI.companion(h, w, avatar, kids),
          h("h2", {}, "Choose your starter avatar"),
          h(
            "p",
            {},
            "Every avatar starts free in a simple T-shirt. Earn outfits through learning.",
          ),
          h(
            "div",
            { class: "row" },
            ...C.AVATARS.map((id) =>
              button(id, () => run({ op: "avatar", id }), {
                "aria-label": "Choose avatar " + id,
                "aria-pressed": String(w.avatar === id),
              }),
            ),
          ),
          h(
            "p",
            {},
            "Your companion stays happy when you take a break. Nothing decays or expires.",
          ),
          h(
            "div",
            { class: "row" },
            ...C.SLOTS.filter((slot) => w.wear[slot]).map((slot) =>
              button("Remove " + slot, () =>
                run({ op: "equip", slot, id: null }),
              ),
            ),
          ),
          ...owned.map((item) =>
            h(
              "div",
              { class: "panel row" },
              h("span", {}, item.icon + " " + item.title),
              button(
                item.kind === "content"
                  ? "Open"
                  : item.kind === "social"
                    ? "Use in My world"
                    : "Wear / apply",
                () =>
                  item.kind === "content"
                    ? open(item.id)
                    : item.kind === "social"
                      ? ((mode = "world"),
                        (worldPanel = DLWorldUI.create({
                          h,
                          getWallet,
                          guest,
                        })),
                        paint())
                      : run({ op: "equip", id: item.id, slot: item.kind }),
              ),
            ),
          ),
        );
        if (!owned.length)
          nodes.push(
            h(
              "p",
              {},
              "Your first reward is 30 coins. Explore new words and stories to get started.",
            ),
          );
        nodes.push(
          button("Export reward progress", () => {
            const u = URL.createObjectURL(
              new Blob([JSON.stringify(w, null, 2)], {
                type: "application/json",
              }),
            );
            h("a", { href: u, download: "learning-rewards.json" }).click();
            setTimeout(() => URL.revokeObjectURL(u), 1000);
          }),
        );
      } else if (mode === "world") nodes.push(worldPanel);
      else if (mode === "clubs") {
        nodes.push(
          h("h2", {}, "Your language clubs"),
          h(
            "p",
            {},
            "Buy lifetime membership in the shop, then exchange learning phrases with other signed-in members. No private messages, links, real names or free-text posts. Kids and guests cannot use the shared boards.",
          ),
          ...catalog
            .filter((x) => x.kind === "club")
            .map((item) =>
              h(
                "article",
                { class: "panel stack" },
                h("h3", {}, item.icon + " " + item.title),
                w.owned.includes(item.id) && !kids && !guest
                  ? button("Open phrase board", () => openClub(item.id))
                  : h(
                      "p",
                      {},
                      w.owned.includes(item.id)
                        ? "Shared boards need an adult account."
                        : item.price + " coins · unlock in the shop",
                    ),
              ),
            ),
        );
        if (clubPanel) nodes.push(clubPanel);
      } else if (mode === "earn")
        nodes.push(
          h(
            "div",
            { class: "panel stack" },
            h("h2", {}, "Earn by learning"),
            ...(kids
              ? [
                  "Kids coins stay in the parent-managed child profile. The child shop has outfits, accessories, themes and learning activities — no property market or social access.",
                  "First correct word-game activity: 2 coins. New successful story: 10 coins. Daily first practice: 3 coins.",
                  "Complete 10 different activities: 15 coins + 25 star points. A perfect story adds 10 star points once; mistakes cost no progress in Kids mode.",
                  "Completed learning-day milestones (1, 7, 30 and 100 days): 5, 30, 100 and 300 extra coins.",
                ]
              : [
                  "Adult / 16+ economy: every 5 first-time successful flashcard reviews earn 1 coin. A first correct word-game activity earns 1 coin.",
                  "A new story with at least 2 of 3 correct earns 3 coins. Improving a partial score to perfect earns 1 extra coin. First successful practice of the day adds 1 coin.",
                  "Complete 20 different activities in one calendar day: 5 coins + 25 star points. Completed learning-day milestones (1, 7, 30 and 100): 1, 6, 20 and 60 coins.",
                  "All adult coin awards, including milestones, share a 20-coin daily cap. Excess awards do not carry forward. Learning and stars can continue after the cap.",
                  "Each different successful daily activity: +2 star points; perfect reading: +10 points once per story. An imperfect story: −5 points once per story; an incorrect word: −2 points at most once per word per day. Losses are capped at 10 points per day and gains at 150. Three stars complete each of Beginner, Intermediate and Advanced. Each successive star needs more points.",
                  "Completed stars can also pay for items. A separate confirmation shows the stage drop before you sacrifice stars. Existing legacy stars migrate to the new ladder; any stars above nine become 20 coins each once. Prices rise through higher tiers. Existing coins and purchases stay yours. Replays do not earn new first-completion awards. There is no passive property income, real-money value, trading, debt or calling.",
                ]
            ).map((t) => h("p", {}, t)),
            h("h3", {}, "Recent activity"),
            ...(w.history.length
              ? [...w.history]
                  .reverse()
                  .map((e) =>
                    h(
                      "p",
                      { class: "small" },
                      `${e.day}: ${e.amount > 0 ? "+" : ""}${e.amount} · ${e.note}`,
                    ),
                  )
              : [h("p", {}, "No coin activity yet.")]),
          ),
        );
      else if (mode === "bonus" || mode === "journey") {
        nodes.push(
          h(
            "h2",
            {},
            mode === "bonus"
              ? "Three bonus mysteries"
              : lang === "it"
                ? "Una settimana a Roma"
                : "Eine Woche in Berlin",
          ),
          h(
            "p",
            {},
            mode === "journey"
              ? "Seven stages at your pace. Complete a chapter with at least one correct answer to open the next. No calendar deadlines."
              : "Three original stories, with questions and explanations.",
          ),
          ...stories
            .filter((s) => s.reward === mode)
            .map((s) => {
              const locked =
                s.stage > 1 && !(w.reading["journey-" + (s.stage - 1)] > 0);
              return h(
                "article",
                { class: "panel stack" },
                h("h3", {}, (s.stage ? s.stage + ". " : "") + s.title),
                h(
                  "p",
                  {},
                  s.sentences.length +
                    " sentences · " +
                    s.questions.length +
                    " questions",
                ),
                h(
                  "p",
                  { class: "small" },
                  w.reading[s.id] === undefined
                    ? "Not completed yet"
                    : "Best: " + w.reading[s.id] + " / 3",
                ),
                button(
                  locked ? "Complete the previous stage" : "Read",
                  () => read(s),
                  { disabled: busy || locked },
                ),
              );
            }),
        );
      } else if (mode === "story") nodes.push(quiz(story));
      else if (mode === "branch") {
        const node = DLRewardAdventure[branch];
        nodes.push(
          h(
            "div",
            { class: "panel stack" },
            h(
              "h2",
              {},
              lang === "it" ? "Un’avventura al parco" : "Ein Abenteuer im Park",
            ),
            h("p", { class: "reward-story", lang }, node.text),
            ...node.choices.map(([label, target]) =>
              button(label, () => {
                branch = target;
                paint();
              }),
            ),
            !node.choices.length
              ? h(
                  "p",
                  {},
                  "The end of this path. Try another route whenever you like.",
                )
              : null,
            button("Start again", () => {
              branch = "start";
              paint();
            }),
          ),
        );
      } else if (mode === "print") nodes.push(printable());
      else if (mode === "personal") nodes.push(personal());
      root.replaceChildren(...nodes.filter(Boolean));
    }
    paint();
    return root;
  },
};
