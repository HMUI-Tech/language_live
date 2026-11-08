import { diffDocs } from "./delta.js";
import { createClient } from "@supabase/supabase-js";
import { makeProgressClient } from "./progress.js";
const buildConfig = __AUTH_CONFIG__;
const guest = new URLSearchParams(location.search).get("guest") === "1";
let client = null,
  progress = null,
  mode = null,
  activeId = null,
  chatDocs = null,
  config = buildConfig;
const timeoutFetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(15000),
  });
const say = (text) => {
  const el = document.querySelector("#auth-status");
  if (el) el.textContent = text;
};
window.DLAuthReady = (async () => {
  try {
    if (buildConfig.hosted) {
      const res = await timeoutFetch("/api/auth-config", { cache: "no-store" });
      if (res.ok) config = await res.json();
    }
    if (config.url && config.key) {
      client = createClient(config.url, config.key, {
        auth: {
          storageKey: "italian-live:auth",
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
        global: { fetch: timeoutFetch },
      });
      progress = makeProgressClient(client);
      const { error } = await client.auth.getSession();
      if (error)
        say(
          "The sign-in link expired or could not be verified. Start sign-in again.",
        );
      client.auth.onAuthStateChange((event, session) => {
        if (
          activeId &&
          (event === "SIGNED_OUT" ||
            (event === "SIGNED_IN" && session?.user.id !== activeId))
        )
          location.reload();
      });
    }
  } catch {
    say(
      "Account services could not be reached. Guest learning is still available.",
    );
  }
})();
async function getUser() {
  await window.DLAuthReady;
  if (guest) return null;
  if (client) {
    const { data } = await client.auth.getUser();
    if (data.user && !data.user.is_anonymous) {
      mode = "supabase";
      activeId = data.user.id;
      return {
        id: "supabase:" + data.user.id,
        name:
          data.user.user_metadata?.full_name || data.user.email || "Learner",
      };
    }
  }
  if (config.hosted) {
    const res = await timeoutFetch("/api/me", { cache: "no-store" });
    if (res.ok) {
      const { user } = await res.json();
      if (user) {
        mode = "chatgpt";
        return user;
      }
    }
  }
  mode = null;
  return null;
}
window.DLAuth = {
  getUser,
  async familyHeaders() {
    await getUser();
    if (mode === "supabase") {
      const { data } = await client.auth.getSession();
      return { Authorization: "Bearer " + data.session.access_token };
    }
    return {};
  },
  async loadProgress() {
    if (mode === "supabase") return progress.load();
    if (mode !== "chatgpt") throw new Error("Sign in to save progress.");
    const res = await timeoutFetch("/api/progress", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load your progress.");
    const loaded = await res.json();
    chatDocs = loaded.docs ? structuredClone(loaded.docs) : null;
    return loaded;
  },
  async saveProgress(docs, revision) {
    if (mode === "supabase") return progress.save(docs, revision);
    if (mode !== "chatgpt") throw new Error("Sign in to save progress.");
    const patch = chatDocs ? diffDocs(chatDocs, docs) : null;
    if (patch && !Object.keys(patch.changed).length && !patch.removed.length)
      return { revision };
    const res = await timeoutFetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch ? { patch, revision } : { docs, revision }),
    });
    if (!res.ok) {
      const error = new Error(
        res.status === 409
          ? "Progress changed on another device. Export this copy and reload."
          : "Could not save progress. Please retry.",
      );
      error.conflict = res.status === 409;
      throw error;
    }
    chatDocs = structuredClone(docs);
    return res.json();
  },
  async signOut() {
    if (mode === "chatgpt") {
      location.assign("/signout-with-chatgpt?return_to=%2F");
      return;
    }
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    location.assign(config.hosted ? "/login" : "/");
  },
};
async function initLogin() {
  if (!document.querySelector("#sign-in")) return;
  await window.DLAuthReady;
  let providers = {};
  if (client) {
    try {
      const res = await timeoutFetch(config.url + "/auth/v1/settings", {
        headers: { apikey: config.key },
        cache: "no-store",
      });
      if (res.ok) providers = (await res.json()).external || {};
    } catch {
      say("Sign-in providers are temporarily unavailable.");
    }
  }
  const google = document.querySelector('[data-provider="google"]');
  if (google) {
    google.disabled = !providers.google || !config.redirectReady;
    google.querySelector("small").textContent =
      providers.google && config.redirectReady
        ? "Save progress across devices"
        : "New-site return URL setup pending";
    google.addEventListener("click", async () => {
      google.disabled = true;
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: location.origin + "/learn" },
        });
        if (error) throw error;
      } catch {
        say("Google sign-in could not start. Try again later.");
        google.disabled = false;
      }
    });
  }
  const form = document.querySelector("#email-form");
  if (form) {
    const button = form.querySelector("button");
    button.disabled = !providers.email || !config.redirectReady;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (button.disabled || !form.reportValidity()) return;
      button.disabled = true;
      say("Sending sign-in link…");
      try {
        const { error } = await client.auth.signInWithOtp({
          email: form.elements.email.value.trim(),
          options: { emailRedirectTo: location.origin + "/learn" },
        });
        if (error) throw error;
        say(
          "Check your email. Open the link in this same browser to finish signing in.",
        );
      } catch (error) {
        say(
          error?.status === 429
            ? "Too many attempts. Please wait before trying again."
            : "Email could not be sent. Email delivery is still being configured; try ChatGPT or guest access.",
        );
      }
      setTimeout(() => {
        button.disabled = false;
      }, 30000);
    });
  }
  const user = await getUser();
  const resume = document.querySelector("#resume");
  if (user && resume) {
    resume.hidden = false;
    resume.textContent = "Continue as " + user.name;
  }
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initLogin, { once: true });
else initLogin();
