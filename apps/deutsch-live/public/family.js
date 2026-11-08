(() => {
  const app = document.querySelector("#app"),
    status = document.querySelector("#status");
  let pin = "",
    profiles = [],
    busy = false;
  const h = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "checked") e.checked = v;
      else e.setAttribute(k, v);
    }
    for (const c of children.flat(Infinity))
      if (c !== null && c !== undefined)
        e.append(c instanceof Node ? c : document.createTextNode(c));
    return e;
  };
  const button = (text, action, cls = "btn") =>
    h(
      "button",
      { type: "button", class: cls, onclick: () => run(action) },
      text,
    );
  async function run(fn) {
    if (busy) return;
    busy = true;
    status.textContent = "";
    try {
      await fn();
    } catch (e) {
      status.textContent = e.message;
      if (app.textContent.includes("Opening the parent area"))
        app.replaceChildren(
          h("h1", {}, "The parent area could not load."),
          h("p", {}, "Your profiles have not been changed. Please retry."),
          button("Try again", () => location.reload()),
          h(
            "p",
            {},
            h(
              "a",
              { href: "/kids.html?guest=1" },
              "Play as a guest while you wait",
            ),
          ),
        );
    } finally {
      busy = false;
    }
  }
  async function api(action, extra = {}) {
    const headers = await DLAuth.familyHeaders();
    const r = await fetch("/api/family", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ action, pin, ...extra }),
      signal: AbortSignal.timeout(15000),
    });
    const b = await r.json();
    if (!r.ok) throw Error(b.error || "Please try again.");
    return b;
  }
  function pinForm(setup) {
    const input = h("input", {
        type: "password",
        inputmode: "numeric",
        pattern: "[0-9]{6,12}",
        minlength: 6,
        maxlength: 12,
        autocomplete: "off",
        required: "",
        name: "pin",
      }),
      check = h("input", { type: "checkbox", required: "" });
    const form = h(
      "form",
      {
        class: "panel",
        onsubmit: (e) => {
          e.preventDefault();
          run(async () => {
            pin = input.value;
            const b = await api(
              setup ? "setup" : "list",
              setup ? { consent: check.checked } : {},
            );
            profiles = b.profiles;
            dashboard();
          });
        },
      },
      h("h2", {}, setup ? "Set up your family" : "Unlock the parent area"),
      h(
        "label",
        {},
        setup ? "Choose a parent PIN (6–12 digits)" : "Parent PIN",
        input,
      ),
      h(
        "p",
        { class: "small" },
        "Keep this PIN private. Five incorrect attempts lock the parent area for 15 minutes.",
      ),
      setup
        ? h(
            "label",
            {},
            check,
            "I am 18 or older and this child’s parent or legal guardian. I consent to storing their nickname, avatar, learning progress and session settings. I have read the privacy information.",
          )
        : null,
      h(
        "button",
        { class: "primary", type: "submit" },
        setup ? "Create family" : "Unlock",
      ),
    );
    app.replaceChildren(
      h("h1", {}, "Their adventure. Your guidance."),
      h(
        "p",
        {},
        "Up to five private child profiles. No child email, full name or birthday is needed.",
      ),
      form,
      h(
        "p",
        { class: "small" },
        "The PIN protects app controls; it is not a device lock or proof of parental identity. Use your device’s parental controls too. Keep your account and PIN on a parent-controlled device. If you forget the PIN, contact the operator from your account email; there is no child-accessible reset.",
      ),
      h(
        "a",
        { href: "/kids.html?guest=1", class: "btn" },
        "Try Kids mode without saving",
      ),
    );
  }
  function editor(p) {
    const name = h("input", {
        name: "nickname",
        value: p?.name || "",
        maxlength: 20,
        required: "",
        autocomplete: "off",
      }),
      avatar = h(
        "select",
        {},
        ...["🦊", "🐼", "🐸", "🦁", "🐨", "🐧"].map((x) =>
          h(
            "option",
            { value: x, ...(x === p?.avatar ? { selected: "" } : {}) },
            x,
          ),
        ),
      ),
      minutes = h(
        "select",
        {},
        ...[5, 10, 15, 20].map((x) =>
          h(
            "option",
            { value: x, ...(x === (p?.minutes || 10) ? { selected: "" } : {}) },
            x + " minutes",
          ),
        ),
      ),
      allowCoins = h("input", {
        type: "checkbox",
        checked: !p?.rewardsDisabled,
      }),
      pause = h("input", { type: "checkbox", checked: p?.paused || false }),
      consent = h("input", { type: "checkbox", required: "" });
    app.replaceChildren(
      h("h1", {}, p ? "Edit child profile" : "A new little explorer"),
      h(
        "form",
        {
          class: "panel",
          onsubmit: (e) => {
            e.preventDefault();
            run(async () => {
              const b = await api(p ? "edit" : "create", {
                id: p?.id,
                name: name.value,
                avatar: avatar.value,
                minutes: Number(minutes.value),
                paused: pause.checked,
                rewardsDisabled: !allowCoins.checked,
                consent: p ? undefined : consent.checked,
              });
              profiles = b.profiles;
              dashboard();
            });
          },
        },
        h("label", {}, "Nickname only — avoid a real full name", name),
        h("label", {}, "Choose an avatar", avatar),
        h("label", {}, "Learning session length", minutes),
        p
          ? h("label", {}, pause, "Pause this profile")
          : h(
              "label",
              {},
              consent,
              "I am this child’s parent or legal guardian and consent to storing this profile and learning progress.",
            ),
        p
          ? h("label", {}, allowCoins, "Allow spending earned learning coins")
          : null,
        h(
          "p",
          { class: "small" },
          "The session ends at this break time, including time spent away from the tab. This is a session limit, not a daily device screen-time limit.",
        ),
        h(
          "div",
          { class: "row" },
          h("button", { class: "primary", type: "submit" }, "Save profile"),
          button("Cancel", dashboard),
        ),
      ),
    );
  }
  function dashboard() {
    app.replaceChildren(
      h("p", { class: "eyebrow" }, "PARENT AREA · ELTERNBEREICH"),
      h("h1", {}, "A little German, together."),
      h(
        "p",
        {},
        "Choose a child to start a session. Each explorer keeps their own words, quests and badges.",
      ),
      h(
        "div",
        { class: "row" },
        button("Add child profile", () => editor(null), "btn primary"),
        button("Lock parent area", () => {
          pin = "";
          profiles = [];
          pinForm(false);
        }),
        button("Return to regular Deutsch Live", async () => {
          await api("exit");
          pin = "";
          location.assign("/learn");
        }),
      ),
      h(
        "div",
        { class: "profiles" },
        profiles.map((p) => {
          const play = DLPlayCore.sanitize(
            p.play,
            new Date().toISOString().slice(0, 10),
          );
          return h(
            "article",
            { class: "panel stack" },
            h("span", { class: "avatar", "aria-hidden": "true" }, p.avatar),
            h("h2", {}, p.name),
            h(
              "p",
              { class: "small" },
              `${Math.max(0, (p.wallet?.earned || 0) - (p.wallet?.spent || 0))} learning coins · ${p.wallet?.owned?.length || 0} permanent rewards`,
            ),
            h(
              "p",
              {},
              `${p.minutes}-minute sessions · ${p.paused ? "Paused" : "Ready to explore"}`,
            ),
            h(
              "p",
              { class: "small" },
              `${play.matches.length} words matched · ${play.articles.length} articles practised · ${Object.keys(play.earned).length} badges`,
            ),
            h(
              "p",
              { class: "small" },
              `${Object.keys(play.days).length} recent active learning days`,
            ),
            h(
              "div",
              { class: "row" },
              button(
                "Start Kids mode",
                async () => {
                  await api("start", { id: p.id });
                  pin = "";
                  profiles = [];
                  location.assign("/kids.html");
                },
                "btn primary",
              ),
              button("Edit / pause", () => editor(p)),
            ),
            h(
              "div",
              { class: "row" },
              button("Reset progress", async () => {
                if (
                  !confirm(
                    "Reset " +
                      p.name +
                      "’s learning progress and badges? This cannot be undone.",
                  )
                )
                  return;
                profiles = (await api("reset", { id: p.id })).profiles;
                dashboard();
              }),
              button(
                "Delete profile",
                async () => {
                  if (
                    !confirm(
                      "Delete " +
                        p.name +
                        "’s profile and stored progress, and withdraw consent for that profile? This cannot be undone.",
                    )
                  )
                    return;
                  profiles = (await api("delete", { id: p.id })).profiles;
                  dashboard();
                },
                "btn danger",
              ),
            ),
          );
        }),
      ),
      h(
        "div",
        { class: "note stack" },
        h("h2", {}, "A calm space to learn"),
        h(
          "p",
          { class: "small" },
          "Learning coins have no cash value. Resetting practice leaves permanent rewards intact; deleting a profile removes its wallet too.",
        ),
        h(
          "p",
          {},
          "Kids mode includes 36 selected everyday words, listening buttons, word matching, articles and short recall lessons. No chat, microphone, public leaderboard, adverts or purchases.",
        ),
        h(
          "p",
          { class: "small" },
          "Guest practice is available without profile storage. Saved profiles use parental consent; delete a profile to withdraw it. Profile removal immediately ends its active session. We do not verify legal parenthood through a PIN.",
        ),
        h(
          "div",
          { class: "row" },
          button("Export family progress", async () => {
            const b = await api("export");
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(b, null, 2)], {
                type: "application/json",
              }),
            );
            h("a", { href: url, download: "deutsch-live-family.json" }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }),
          button("Change parent PIN", () => changePin()),
        ),
      ),
    );
  }
  function changePin() {
    const input = h("input", {
      type: "password",
      inputmode: "numeric",
      pattern: "[0-9]{6,12}",
      minlength: 6,
      maxlength: 12,
      required: "",
      autocomplete: "off",
    });
    app.replaceChildren(
      h("h1", {}, "Change parent PIN"),
      h(
        "form",
        {
          class: "panel",
          onsubmit: (e) => {
            e.preventDefault();
            run(async () => {
              await api("change-pin", { newPin: input.value });
              pin = "";
              pinForm(false);
              status.textContent =
                "PIN changed. All child sessions have ended.";
            });
          },
        },
        h("label", {}, "New PIN", input),
        h(
          "div",
          { class: "row" },
          h("button", { class: "primary", type: "submit" }, "Save new PIN"),
          button("Cancel", dashboard),
        ),
      ),
    );
  }
  run(async () => {
    await DLAuthReady;
    const user = await DLAuth.getUser();
    if (!user) {
      app.replaceChildren(
        h("h1", {}, "A parent starts the adventure."),
        h(
          "p",
          {},
          "Sign in with your own adult account, then return here to set up child profiles.",
        ),
        h(
          "div",
          { class: "row" },
          h("a", { href: "/login", class: "btn primary" }, "Parent sign-in"),
          h(
            "a",
            { href: "/kids.html?guest=1", class: "btn" },
            "Try Kids mode as a guest",
          ),
        ),
      );
      return;
    }
    const b = await api("status");
    pinForm(!b.setup);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && pin) {
      pin = "";
      profiles = [];
      pinForm(false);
    }
  });
})();
