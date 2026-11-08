(() => {
  const C = DLPlayCore,
    app = document.querySelector("#app"),
    status = document.querySelector("#status"),
    session = document.querySelector("#session"),
    guest = new URLSearchParams(location.search).get("guest") === "1";
  let profile = { name: "Explorer", avatar: "🦊" },
    play = C.empty(),
    expires = 0,
    ended = false,
    pending = Promise.resolve(),
    serial = 0;
  const today = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(
      new Date(),
    );
  const h = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "disabled") e.disabled = v;
      else if (k === "checked") e.checked = v;
      else e.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity))
      if (c !== null && c !== undefined)
        e.append(c instanceof Node ? c : document.createTextNode(c));
    return e;
  };
  const button = (text, fn) =>
    h("button", { type: "button", class: "btn", onclick: fn }, text);
  function speak(text) {
    if (!window.speechSynthesis) return;
    const voices = speechSynthesis
      .getVoices()
      .filter((v) => v.localService && v.lang.startsWith("it"));
    if (!voices.length) {
      status.textContent =
        "An offline Italian voice is not installed on this device. You can still read and play.";
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    u.voice = voices[0];
    u.rate = 0.85;
    speechSynthesis.speak(u);
  }
  function finish() {
    ended = true;
    window.speechSynthesis?.cancel();
    app.replaceChildren(
      h(
        "div",
        { class: "panel break" },
        h("span", { class: "avatar" }, "🌱"),
        h("h1", {}, "È ora di una pausa!"),
        h(
          "p",
          {},
          "Time for a break. You did something good for your Italian today.",
        ),
        h(
          "p",
          {},
          guest
            ? "Guest progress lasts only while this page stays open."
            : "Your saved progress is waiting for your next adventure.",
        ),
        h(
          "a",
          { href: "/family.html", class: "btn primary" },
          "Ask a parent to start again",
        ),
      ),
    );
    session.textContent = "Session finished";
  }
  async function api(body) {
    const r = await fetch(
      "/api/kids",
      body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000),
          }
        : { cache: "no-store", signal: AbortSignal.timeout(15000) },
    );
    const b = await r.json();
    if (!r.ok) {
      if (r.status === 401) finish();
      throw Error(b.error);
    }
    return b;
  }
  let rewardWallet = DLRewardCore.empty();
  function showWallet(w) {
    rewardWallet = DLRewardCore.normalize(w);
    document.documentElement.dataset.rewardTheme =
      rewardWallet.wear.theme || "";
    document.querySelector("#kids-coins").textContent =
      "🪙 " + DLRewardCore.balance(rewardWallet) + " coins";
  }
  function childAct(event) {
    if (ended)
      return Promise.reject(
        Error("Time for a break. Ask a parent to start a new session."),
      );
    const task = async () => {
      if (guest) {
        showWallet(
          DLRewardCore.apply(rewardWallet, event, {
            day: today(),
            words: C.WORDS,
            stories: DLRewardStories,
            kids: true,
          }),
        );
      } else {
        const b = await api({ action: "reward", event });
        showWallet(b.wallet);
        if (b.play) play = b.play;
      }
      return rewardWallet;
    };
    const result = pending.then(task);
    pending = result.catch(() => {});
    return result;
  }
  function openShop() {
    if (ended) return;
    app.replaceChildren(
      DLRewardUI.create({
        h,
        getWallet: () => rewardWallet,
        act: childAct,
        kids: true,
        guest,
        speak,
        avatar: profile.avatar,
        spendingEnabled: !profile.rewardsDisabled,
      }),
      h("p", {}, button("Back to games", home)),
    );
  }
  document.querySelector("#kids-coins").addEventListener("click", openShop);
  function event(action, id) {
    if (ended) return;
    if (guest) {
      try {
        showWallet(
          DLRewardCore.apply(
            rewardWallet,
            { op: "event", kind: action, id },
            {
              day: today(),
              words: C.WORDS,
              stories: DLRewardStories,
              kids: true,
            },
          ),
        );
      } catch (e) {
        status.textContent = e.message;
      }
      return;
    }
    status.textContent = "Saving…";
    const result = pending.then(async () => {
      const b = await api({ action, id });
      if (b.play) play = b.play;
      showWallet(b.wallet);
      status.textContent = "Saved ✓";
    });
    pending = result.catch((e) => {
      status.textContent =
        e.message +
        " Your latest answer may not be saved. Reload before continuing.";
    });
  }
  function home() {
    if (ended) return;
    const welcome = h(
      "div",
      { class: "panel" },
      h("p", { class: "eyebrow" }, "CIAO, " + profile.name.toUpperCase() + "!"),
      h("h1", {}, profile.avatar + " Let’s explore Italian."),
      h("p", {}, "Small steps. Big discoveries. Mistakes help us learn."),
      h(
        "div",
        { class: "row" },
        button("Learn five words", lesson),
        guest
          ? h(
              "a",
              { href: "/learn", class: "btn" },
              "Back to main Italian Live",
            )
          : null,
        button("Finish for now", async () => {
          await pending;
          if (!guest) await api({ action: "end" }).catch(() => {});
          finish();
        }),
      ),
    );
    app.replaceChildren(
      welcome,
      DLRewardUI.companion(h, rewardWallet, profile.avatar, true),
      button("Open Reward Shop", openShop),
      DLPlayUI.create({
        h,
        today,
        getProgress: () => play,
        getLog: () => ({}),
        onChange: (p) => {
          play = p;
        },
        onEvent: event,
        onMistake: (id) => event("mistake", id),
        speak,
        onActivity: () => {},
        navigate: lesson,
        kids: true,
      }),
    );
  }
  function lesson() {
    if (ended) return;
    let index = 0,
      answered = false;
    const words = C.shuffled(C.WORDS, today() + ":lesson:" + ++serial).slice(
      0,
      5,
    );
    function paint() {
      if (ended) return;
      const w = words[index],
        choices = C.shuffled(
          [w, ...C.WORDS.filter((x) => x.id !== w.id).slice(0, 2)],
          w.id + serial,
        );
      app.replaceChildren(
        h(
          "div",
          { class: "panel stack" },
          h("p", { class: "eyebrow" }, "LE MIE PAROLE · MY WORDS"),
          h("p", {}, "Word " + (index + 1) + " of 5"),
          h("span", { class: "play-picture", "aria-hidden": "true" }, w.emoji),
          h("h1", { class: "lesson-word", lang: "it" }, C.phrase(w)),
          button("Listen 🔊", () => speak(C.phrase(w))),
          h("p", {}, "What does this word mean?"),
          h(
            "div",
            { class: "row" },
            choices.map((choice) =>
              button(choice.en, () => {
                if (answered) return;
                if (choice.id !== w.id) {
                  event("mistake", w.id);
                  status.textContent =
                    "Good try! " +
                    C.phrase(w) +
                    " means " +
                    w.en +
                    ". Try again.";
                  return;
                }
                answered = true;
                play = C.recordReview(play, today(), w.id, true, {});
                event("recall", w.id);
                paint();
              }),
            ),
          ),
          answered
            ? h(
                "div",
                { class: "kids-note" },
                "Giusto! " + C.phrase(w) + " = " + w.en,
              )
            : null,
          answered
            ? button(
                index === 4 ? "Well done! Back to games" : "Next word",
                () => {
                  if (index === 4) home();
                  else {
                    index++;
                    answered = false;
                    paint();
                  }
                },
              )
            : null,
          button("Back to games", home),
        ),
      );
    }
    paint();
  }
  (async () => {
    try {
      if (guest) {
        expires = Date.now() + 10 * 60000;
        session.textContent =
          "Guest adventure · 10 minutes · progress stays in this page only";
      } else {
        const b = await api();
        profile = b.profile;
        showWallet(profile.wallet);
        play = C.sanitize(profile.play, today());
        expires = b.expires;
      }
      showWallet(rewardWallet);
      home();
      const tick = () => {
        if (ended) return;
        if (Date.now() >= expires) {
          finish();
          return;
        }
        session.textContent =
          (guest ? "Guest adventure" : profile.avatar + " " + profile.name) +
          " · " +
          Math.ceil((expires - Date.now()) / 60000) +
          " min until a break";
      };
      tick();
      setInterval(tick, 1000);
      document.addEventListener("visibilitychange", tick);
    } catch (e) {
      if (!ended) {
        app.replaceChildren(
          h("h1", {}, "Ready for an adventure?"),
          h("p", {}, "Ask a parent to choose your profile."),
          h("a", { href: "/family.html", class: "btn primary" }, "Parent area"),
        );
      }
      status.textContent = e.message;
    }
  })();
})();
