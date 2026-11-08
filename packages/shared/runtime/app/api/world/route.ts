import {
  learningRuntime,
  type WorldEnvironment,
} from "../../../lib/runtime-types";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import {
  parentIdentity,
  cookieToken,
  bodyJSON,
  reply,
  randomToken,
} from "../../../lib/family.mjs";
import { walletBridge } from "../../../lib/rewards.mjs";
import {
  socialId,
  isModerator,
  ensureSocialIds,
} from "../../../lib/world-identity.mjs";
import { safeFailure } from "../../../lib/api-errors.mjs";
import { worldAction } from "../../../lib/world.mjs";
import "../../../public/rewards-core.js";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const body = await bodyJSON(request);
    if (cookieToken(request))
      return reply(
        { error: "Kids profiles cannot access the 16+ world." },
        403,
      );
    const owner = await parentIdentity(request, env, getChatGPTUser);
    if (!owner) return reply({ error: "Sign in to enter the 16+ world." }, 401);
    const vars = env as unknown as WorldEnvironment;
    if (!vars.DB)
      return reply({ error: "World temporarily unavailable." }, 503);
    const C = learningRuntime.DLRewardCore;
    const row = await walletBridge(env, "read", owner),
      wallet = C.normalize(row?.data);
    const moderator =
      !request.headers.has("authorization") &&
      isModerator(await getChatGPTUser(), vars.MODERATOR_USER_IDS);
    if (!wallet.ageBand)
      return reply({ error: "Choose your 16+ age band first." }, 403);
    const id = await socialId(owner, vars.WORLD_ID_KEY);
    await ensureSocialIds(vars.DB, id, vars.WORLD_ID_KEY);
    return reply(
      await worldAction({
        db: vars.DB,
        id,
        wallet,
        body,
        C,
        token: () => randomToken().slice(0, 32),
        moderator,
      }),
    );
  } catch (error: unknown) {
    const failure = safeFailure(error);
    return reply({ error: failure.message }, failure.status);
  }
}
