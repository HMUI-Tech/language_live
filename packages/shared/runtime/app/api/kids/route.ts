import { LEARNING_TIME_ZONE } from "../../../lib/language-config.mjs";
import { safeFailure } from "../../../lib/api-errors.mjs";
import { learningRuntime, type ChildProfile } from "../../../lib/runtime-types";
import { env } from "cloudflare:workers";
import {
  bridge,
  cookieToken,
  digest,
  reply,
  bodyJSON,
  publicProfile,
  childCookie,
} from "../../../lib/family.mjs";
// The child endpoint accepts events, never arbitrary progress or parent/profile changes.
import "../../../public/play-core.js";
import "../../../public/rewards-core.js";
import "../../../public/rewards-data.js";
export const dynamic = "force-dynamic";
async function current(request: Request) {
  const token = cookieToken(request);
  if (!token) return null;
  const hash = await digest(token);
  const row = await bridge(env, "child", hash);
  const p = row?.data.profiles.find((x: ChildProfile) => x.token === hash);
  return p && !p.paused && p.expires > Date.now() ? { row, p } : null;
}
export async function GET(request: Request) {
  try {
    const c = await current(request);
    return c
      ? reply({ profile: publicProfile(c.p), expires: c.p.expires })
      : reply(
          { error: "Ask your parent to start a learning session." },
          401,
          childCookie("", 0),
        );
  } catch {
    return reply(
      { error: "Could not load this session. Please try again." },
      503,
    );
  }
}
export async function POST(request: Request) {
  try {
    const b = await bodyJSON(request);
    if (b.action === "end") {
      const token = cookieToken(request);
      if (token) await bridge(env, "end-child", await digest(token));
      return reply({ ok: true }, 200, childCookie("", 0));
    }
    const c = await current(request);
    if (!c)
      return reply(
        {
          error: "Time for a break. Ask your parent to start another session.",
        },
        401,
        childCookie("", 0),
      );
    const C = learningRuntime.DLPlayCore,
      R = learningRuntime.DLRewardCore;
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: LEARNING_TIME_ZONE,
    }).format(new Date());
    if (b.action === "reward") {
      if (
        ["buy", "exchange-stars"].includes(b.event?.op) &&
        c.p.rewardsDisabled
      )
        return reply(
          { error: "A parent has paused coin spending for this profile." },
          403,
        );
      c.p.wallet = R.apply(c.p.wallet, b.event, {
        day,
        words: C.WORDS,
        stories: learningRuntime.DLRewardStories,
        kids: true,
      });
      if (b.event?.op === "event" && b.event.kind === "recall")
        c.p.play = C.recordReview(c.p.play, day, b.event.id, true, {});
      await bridge(env, "write", c.row.owner, c.row.data, c.row.revision);
      return reply({ wallet: c.p.wallet, play: c.p.play });
    }
    if (
      !C.WORDS.some((w: { id: string }) => w.id === b.id) ||
      !["match", "articles", "recall", "mistake"].includes(b.action)
    )
      return reply({ error: "Invalid learning event." }, 400);

    if (b.action !== "mistake")
      c.p.play =
        b.action === "recall"
          ? C.recordReview(c.p.play, day, b.id, true, {})
          : C.record(c.p.play, day, b.action, b.id, {});
    c.p.wallet = R.apply(
      c.p.wallet,
      { op: "event", kind: b.action, id: b.id },
      {
        day,
        words: C.WORDS,
        stories: learningRuntime.DLRewardStories,
        kids: true,
      },
    );
    await bridge(env, "write", c.row.owner, c.row.data, c.row.revision);
    return reply({ play: c.p.play, wallet: c.p.wallet });
  } catch (error) {
    const failure = safeFailure(error);
    return reply({ error: failure.message }, failure.status);
  }
}
