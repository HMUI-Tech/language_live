import { REWARDS_RPC } from "./language-config.mjs";
/** @param {object|null} [payload] */
export async function walletBridge(
  vars,
  op,
  who,
  payload = null,
  expected = 0,
) {
  if (
    !vars.REWARDS_SERVER_KEY ||
    !vars.SUPABASE_URL ||
    !vars.SUPABASE_PUBLISHABLE_KEY
  )
    throw Error("Rewards are temporarily unavailable.");
  const r = await fetch(vars.SUPABASE_URL + "/rest/v1/rpc/" + REWARDS_RPC, {
    method: "POST",
    headers: {
      apikey: vars.SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      op,
      who,
      payload,
      expected,
      server_key: vars.REWARDS_SERVER_KEY,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const t = await r.text();
    const e = Error(
      t.includes("wallet_conflict")
        ? "Your wallet changed on another device. Reload the shop before spending."
        : "Rewards are temporarily unavailable.",
    );
    e.status = t.includes("wallet_conflict") ? 409 : 503;
    throw e;
  }
  return r.json();
}
