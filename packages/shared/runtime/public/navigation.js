/* Accessible account drawer. Learning state stays in the existing app. */
(function (root) {
  let current = null;
  const englishLabels = {
    today: "Today",
    play: "Play",
    cards: "Flashcards",
    reading: "Reading",
    talk: "Speaking",
    tutor: "Tutor",
    articles: "Grammar articles",
    english: "English",
    progress: "Progress",
    shop: "Rewards",
  };
  const legal = [
    ["/impressum.html", "Impressum"],
    ["/privacy.html", "Datenschutz"],
    ["/terms.html", "Nutzungsbedingungen"],
    ["/credits.html", "Quellen & Lizenzen"],
  ];
  function footer(h) {
    return h(
      "footer",
      { class: "site-footer" },
      h(
        "nav",
        { "aria-label": "Legal information" },
        ...legal.map(([href, label]) => h("a", { href }, label)),
      ),
    );
  }
  function create({
    h,
    items,
    selected,
    onNavigate,
    user,
    accountContent,
    coins = 0,
  }) {
    if (current) current.close(false);
    const trigger = h(
      "button",
      {
        type: "button",
        class: "account-menu-toggle",
        "aria-label": "Account and navigation menu",
        "aria-haspopup": "dialog",
        "aria-controls": "account-navigation",
        "aria-expanded": "false",
        title: "Account & menu",
      },
      h("span", {
        class: "account-person-icon",
        "aria-hidden": "true",
        html: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="16" cy="11" r="4.5"/><path d="M7 27v-2a9 9 0 0 1 18 0v2"/></svg>',
      }),
      h("span", { class: "account-menu-bars", "aria-hidden": "true" }, "☰"),
    );
    const dialog = h("dialog", {
      id: "account-navigation",
      class: "navigation-drawer",
      "aria-labelledby": "navigation-title",
    });
    let opened = false,
      previousOverflow = "";
    function close(restore = true) {
      if (!opened) return;
      opened = false;
      document.body.style.overflow = previousOverflow;
      trigger.setAttribute("aria-expanded", "false");
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      if (restore && trigger.isConnected) trigger.focus();
    }
    function open() {
      if (opened) return;
      opened = true;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      trigger.setAttribute("aria-expanded", "true");
      if (typeof dialog.showModal === "function") dialog.showModal();
      else {
        dialog.setAttribute("open", "");
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("role", "dialog");
      }
      dialog.querySelector(".navigation-close")?.focus();
    }
    const choose = (view) => {
      close(false);
      onNavigate(view);
    };
    const nav = h(
      "nav",
      { class: "drawer-sections", "aria-label": "Learning sections" },
      ...items.map(([id, label]) =>
        h(
          "button",
          {
            type: "button",
            class: "drawer-entry",
            "aria-current": selected === id ? "page" : null,
            onclick: () => choose(id),
          },
          h(
            "span",
            { class: "drawer-label" },
            h("span", {}, label),
            englishLabels[id] && englishLabels[id] !== label
              ? h(
                  "span",
                  { class: "drawer-label-english", lang: "en" },
                  englishLabels[id],
                )
              : null,
          ),
          id === "shop"
            ? h(
                "span",
                { id: "coin-balance", class: "drawer-coins" },
                "🪙 " + coins,
              )
            : null,
        ),
      ),
      h(
        "a",
        {
          href: "/family.html",
          class: "drawer-entry drawer-family",
          onclick: () => close(false),
        },
        h("span", {}, "Kids & Family"),
        h("span", { "aria-hidden": "true" }, "↗"),
      ),
    );
    dialog.append(
      h(
        "div",
        { class: "drawer-heading" },
        h("h2", { id: "navigation-title" }, "Menu"),
        h(
          "button",
          {
            type: "button",
            class: "navigation-close",
            "aria-label": "Close menu",
            onclick: () => close(),
          },
          "×",
        ),
      ),
      h(
        "section",
        { class: "drawer-account", "aria-label": "Account" },
        h("p", { class: "drawer-account-label" }, "ACCOUNT"),
        h(
          "p",
          { class: "drawer-account-name" },
          user ? user.name : "Guest learner",
        ),
        h(
          "p",
          { class: "small muted" },
          user
            ? "Your saved learning account"
            : "Sign in to keep your progress across visits.",
        ),
        accountContent || null,
      ),
      nav,
    );
    trigger.addEventListener("click", open);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("close", () => close(false));
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        close();
    });
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || typeof dialog.showModal === "function") return;
      const list = Array.from(
        dialog.querySelectorAll(
          "button:not([disabled]),a[href],input:not([hidden])",
        ),
      ).filter((el) => !el.hidden);
      const first = list[0],
        last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    });
    current = { close, open };
    return { trigger, dialog, close, open };
  }
  root.LLNavigation = {
    create,
    footer,
    updateCoins(amount) {
      const el = document.querySelector("#coin-balance");
      if (el) el.textContent = "🪙 " + amount;
    },
  };
})(window);
