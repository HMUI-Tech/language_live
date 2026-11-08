/* Optional screens load their content only when needed. Failed loads can be retried. */
(function (root) {
  const groups = {
    "reward-engine": ["/rewards-data.js", "/reading-data.js"],
    shop: [
      "/rewards-data.js",
      "/reading-data.js",
      "/rewards-ui.js",
      "/world-ui.js",
    ],
    reading: ["/reading-data.js", "/reading-ui.js"],
    play: ["/play-ui.js"],
    articles: ["/learning-guides.js"],
    english: ["/learning-guides.js"],
  };
  const files = new Map(),
    complete = new Set(),
    pending = new Map();
  function script(url) {
    if (files.has(url)) return files.get(url);
    const promise = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = url;
      el.async = true;
      el.onload = resolve;
      el.onerror = () => {
        el.remove();
        files.delete(url);
        reject(Error("Could not load this practice screen. Please retry."));
      };
      document.head.append(el);
    });
    files.set(url, promise);
    return promise;
  }
  function ready(name) {
    return !groups[name] || complete.has(name);
  }
  function load(name) {
    if (ready(name)) return Promise.resolve();
    if (pending.has(name)) return pending.get(name);
    const promise = (async () => {
      for (const url of groups[name]) await script(url);
      complete.add(name);
    })().finally(() => pending.delete(name));
    pending.set(name, promise);
    return promise;
  }
  root.DLLazy = { ready, load };
})(globalThis);
