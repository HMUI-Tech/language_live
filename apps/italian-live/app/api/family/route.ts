import {type ChildProfile} from "../../../lib/runtime-types";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  bridge,
  parentIdentity,
  bodyJSON,
  reply,
  randomToken,
  pinHash,
  validPin,
  profileSettings,
  publicProfile,
  digest,
  childCookie,
} from "../../../lib/family.mjs";
export const dynamic = "force-dynamic";
// This probe reads no user record and exposes no configuration or account data.
export async function GET() {
  try {
    await bridge(env, "read", "healthcheck:no-profile");
    return reply({ available: true });
  } catch {
    return reply({ available: false }, 503);
  }
}
export async function POST(request: Request) {
  try {
    const b = await bodyJSON(request),
      vars = env as unknown as Record<string, string>,
      owner = await parentIdentity(request, vars, getChatGPTUser);
    if (!owner)
      return reply({ error: "A parent needs to sign in first." }, 401);
    let row = await bridge(vars, "read", owner),
      d = row?.data;
    if (b.action === "status") return reply({ setup: !!d });
    if (!d) {
      if (b.action !== "setup" || b.consent !== true || !validPin(b.pin))
        return reply(
          {
            error:
              "Confirm parental responsibility and choose a 6–12 digit PIN (avoid simple sequences).",
          },
          400,
        );
      const salt = randomToken();
      d = {
        v: 1,
        salt,
        pin: await pinHash(b.pin, salt),
        failures: 0,
        lockedUntil: 0,
        consent: {
          version: "2026-11-05",
          at: new Date().toISOString(),
          statement: "Adult parent/guardian; consent to child profile storage",
        },
        profiles: [],
      };
      await bridge(vars, "write", owner, d, 0);
      return reply({ profiles: [] });
    }
    const candidate =
      typeof b.pin === "string" && /^\d{6,12}$/.test(b.pin)
        ? await pinHash(b.pin, d.salt)
        : "";
    const attempt = await bridge(vars, "pin", owner, {
      candidate,
      salt: d.salt,
    });
    if (attempt.locked)
      return reply(
        {
          error:
            "Too many incorrect PINs. Wait 15 minutes before trying again.",
        },
        429,
      );
    if (attempt.retry)
      return reply({ error: "The parent PIN changed. Please try again." }, 409);
    if (!attempt.authorized)
      return reply({ error: "Incorrect parent PIN." }, 403);
    row = attempt.row;
    d = row.data;
    const p = d.profiles.find((x: ChildProfile) => x.id === b.id);
    if (b.action === "create") {
      if (b.consent !== true)
        return reply(
          { error: "Confirm parental consent for this child profile." },
          400,
        );
      if (d.profiles.length >= 5)
        return reply({ error: "You can have up to five child profiles." }, 400);
      d.profiles.push({
        id: crypto.randomUUID(),
        ...profileSettings(b),
        consent: { at: new Date().toISOString(), version: "2026-11-05" },
        play: null,
        paused: false,
      });
    } else if (b.action === "edit") {
      if (!p) return reply({ error: "Profile not found." }, 404);
      Object.assign(p, profileSettings(b));
      p.paused = !!b.paused;
      p.rewardsDisabled = !!b.rewardsDisabled;
      p.token = null;
    } else if (b.action === "reset") {
      if (!p) return reply({ error: "Profile not found." }, 404);
      p.play = null;
      p.token = null;
    } else if (b.action === "delete") {
      if (!p) return reply({ error: "Profile not found." }, 404);
      d.profiles = d.profiles.filter((x: ChildProfile) => x.id !== b.id);
    } else if (b.action === "change-pin") {
      if (!validPin(b.newPin))
        return reply({ error: "Choose a stronger 6–12 digit PIN." }, 400);
      d.salt = randomToken();
      d.pin = await pinHash(b.newPin, d.salt);
      for (const x of d.profiles) x.token = null;
    } else if (b.action === "start") {
      if (!p || p.paused)
        return reply({ error: "This profile is paused or unavailable." }, 403);
      const token = randomToken();
      p.token = await digest(token);
      p.expires = Date.now() + p.minutes * 60000;
      await bridge(vars, "write", owner, d, row.revision);
      return reply({ ok: true }, 200, childCookie(token, p.minutes * 60));
    } else if (!["list", "export", "exit"].includes(b.action))
      return reply({ error: "Unknown action." }, 400);
    await bridge(vars, "write", owner, d, row.revision);
    return reply(
      {
        profiles: d.profiles.map(publicProfile),
        ...(b.action === "export" ? { consent: d.consent } : {}),
      },
      200,
      b.action === "exit" ? childCookie("", 0) : undefined,
    );
  } catch (e) {
    return reply(
      { error: e instanceof Error ? e.message : "Request failed." },
      400,
    );
  }
}
