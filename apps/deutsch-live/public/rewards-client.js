(function (root) {
  let wallet = DLRewardCore.empty(),
    guest = true,
    pending = Promise.resolve();
  const listeners = new Set();
  function show(next) {
    wallet = DLRewardCore.normalize(next);
    const theme = wallet.wear.theme || "";
    document.documentElement.dataset.rewardTheme = theme;
    for (const fn of listeners) fn(wallet);
  }
  async function request(body) {
    const headers = await window.DLAuth.familyHeaders();
    const r = await fetch("/api/rewards", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const b = await r.json();
    if (!r.ok) throw Error(b.error || "Rewards could not be saved.");
    return b.wallet;
  }
  root.DLRewardClient = {
    get: () => wallet,
    isGuest: () => guest,
    subscribe(fn) {
      listeners.add(fn);
      fn(wallet);
      return () => listeners.delete(fn);
    },
    async init(user) {
      guest = !user;
      if (!guest) show(await request({ op: "load" }));
      else show(wallet);
    },
    act(event) {
      const task = async () => {
        if (guest) await root.DLLazy?.load("reward-engine");
        const next = guest
          ? DLRewardCore.apply(wallet, event, {
              day: new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Berlin",
              }).format(new Date()),
              words: DLPlayCore.WORDS,
              stories: DLReadingStories.concat(DLRewardStories),
              cardIds: DLRewardCardIds,
              kids: false,
            })
          : await request(event);
        show(next);
        return wallet;
      };
      const result = pending.then(task);
      pending = result.catch(() => {});
      return result;
    },
  };
})(window);
