import {
  socialId,
  migrateSocialId,
  ensureSocialIds,
  isModerator,
} from "../lib/world-identity.mjs";
import { digest } from "../lib/family.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { DatabaseSync } from "node:sqlite";
import { worldAction, cleanMessage } from "../lib/world.mjs";
const ctx = {};
vm.runInNewContext(fs.readFileSync("public/rewards-core.js", "utf8"), ctx);
const C = ctx.DLRewardCore;
function setup() {
  const sql = new DatabaseSync(":memory:");
  for (const f of fs
    .readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sql.exec(fs.readFileSync("drizzle/" + f, "utf8"));
  const db = {
    prepare(q) {
      const stmt = sql.prepare(q);
      return {
        bind(...args) {
          return {
            first: async () => stmt.get(...args) || null,
            all: async () => ({ results: stmt.all(...args) }),
            run: async () => ({ meta: { changes: stmt.run(...args).changes } }),
          };
        },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        sql.exec("COMMIT");
        return results;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  let now = 1800000000000,
    serial = 0;
  const wallets = {};
  const ids = {
    a: "a".repeat(64),
    b: "b".repeat(64),
    t: "c".repeat(64),
    x: "d".repeat(64),
  };
  for (const [name, id] of Object.entries(ids))
    wallets[id] = {
      ...C.empty(),
      ageBand: name === "t" ? "16-17" : "18+",
      owned: ["friends-pass", "private-club-pass", "cafe-club"],
    };
  const call = (who, body, extra = {}) =>
    worldAction({
      db,
      id: ids[who],
      wallet: wallets[ids[who]],
      body,
      C,
      token: () => String(++serial).padStart(32, "0"),
      now,
      ...extra,
    });
  return {
    db,
    sql,
    call,
    ids,
    wallets,
    advance(ms) {
      now += ms;
    },
    close: () => sql.close(),
  };
}
test("age gates, optional enrolment, cohort isolation and earned entitlement checks", async () => {
  const t = setup();
  try {
    let d = await t.call("a", { op: "load" });
    assert.equal(d.enrolled, false);
    await assert.rejects(t.call("a", { op: "enroll" }));
    const a = await t.call("a", { op: "enroll", confirm: true });
    await t.call("t", { op: "enroll", confirm: true });
    assert.equal(a.ageBand, "18+");
    assert(!("email" in a));
    await assert.rejects(
      t.call("t", { op: "friend-request", code: a.code }),
      /connection is unavailable/,
    );
    t.wallets[t.ids.a].owned = [];
    await assert.rejects(t.call("a", { op: "create-club" }), /charter/);
    await assert.rejects(
      t.call("a", { op: "join-public", club: "cafe-club" }),
      /Unlock/,
    );
    t.wallets[t.ids.a].ageBand = null;
    await assert.rejects(t.call("a", { op: "load" }), /16\+/);
  } finally {
    t.close();
  }
});
test("friend messages require mutual acceptance; blocks apply in both directions", async () => {
  const t = setup();
  try {
    const a = await t.call("a", { op: "enroll", confirm: true });
    await t.call("b", { op: "enroll", confirm: true });
    let b = await t.call("b", { op: "friend-request", code: a.code });
    const f = b.friends[0].id,
      room = "friend:" + f;
    await assert.rejects(
      t.call("b", { op: "send", room, text: "Hello!" }),
      /Accept/,
    );
    await assert.rejects(
      t.call("b", { op: "friend-response", friend: f, accept: true }),
      /unavailable/,
    );
    await t.call("a", { op: "friend-response", friend: f, accept: true });
    let r = await t.call("b", {
      op: "send",
      room,
      text: "Hallo! Wie geht es dir?",
    });
    assert.equal(r.messages.length, 1);
    await assert.rejects(
      t.call("b", { op: "send", room, text: "Second" }),
      /wait 5 seconds/,
    );
    await t.call("a", { op: "block", person: t.ids.b });
    assert.equal((await t.call("a", { op: "load" })).friends.length, 0);
    await assert.rejects(t.call("a", { op: "messages", room }), /unavailable/);
    await assert.rejects(t.call("b", { op: "messages", room }), /unavailable/);
    await t.call("a", { op: "unblock", person: t.ids.b });
    assert.equal(
      (await t.call("a", { op: "messages", room })).messages.length,
      1,
    );
    await t.call("a", { op: "disable" });
    await assert.rejects(t.call("b", { op: "messages", room }), /unavailable/);
  } finally {
    t.close();
  }
});
test("private club invites enforce cohort, membership, expiry and owner-only removal", async () => {
  const t = setup();
  try {
    for (const n of ["a", "b", "t", "x"])
      await t.call(n, { op: "enroll", confirm: true });
    const a = await t.call("a", { op: "create-club" }),
      r = a.rooms[0];
    assert(r.invite);
    await assert.rejects(t.call("x", { op: "messages", room: r.id }), /Join/);
    await assert.rejects(
      t.call("t", { op: "join-private", code: r.invite }),
      /unavailable/,
    );
    await t.call("b", { op: "join-private", code: r.invite });
    assert.equal(
      (await t.call("b", { op: "messages", room: r.id })).messages.length,
      0,
    );
    await assert.rejects(
      t.call("b", { op: "rotate-club", room: r.id }),
      /owner/,
    );
    await t.call("a", { op: "remove-member", room: r.id, person: t.ids.b });
    await assert.rejects(t.call("b", { op: "messages", room: r.id }), /Join/);
    await assert.rejects(
      t.call("b", { op: "join-private", code: r.invite }),
      /unavailable/,
    );
    const fresh = (await t.call("a", { op: "load" })).rooms[0];
    t.advance(8 * 86400000);
    await assert.rejects(
      t.call("b", { op: "join-private", code: fresh.invite }),
      /expired/,
    );
  } finally {
    t.close();
  }
});
test("public club rooms are cohort-separated; reports are private and operator actions are authorized", async () => {
  const t = setup();
  try {
    for (const n of ["a", "b", "t"]) {
      await t.call(n, { op: "enroll", confirm: true });
      await t.call(n, { op: "join-public", club: "cafe-club" });
    }
    const room = "club:cafe-club:18+";
    await assert.rejects(t.call("t", { op: "messages", room }), /Join/);
    const post = await t.call("b", {
        op: "send",
        room,
        text: "Guten Morgen, alle zusammen!",
      }),
      mid = post.messages[0].id;
    assert.equal(
      (
        await t.call("a", {
          op: "report",
          room,
          message: mid,
          reason: "Harassment",
        })
      ).messages.length,
      0,
    );
    assert.equal(
      (await t.call("b", { op: "messages", room })).messages.length,
      1,
    );
    await assert.rejects(t.call("a", { op: "moderation" }), /Operator/);
    let mods = await t.call("a", { op: "moderation" }, { moderator: true });
    assert.equal(mods.reports.length, 1);
    await t.call(
      "a",
      { op: "moderation", action: "ban", report: mods.reports[0].id },
      { moderator: true },
    );
    await assert.rejects(t.call("b", { op: "load" }), /suspended/);
    assert.equal(
      (await t.call("a", { op: "messages", room })).messages.length,
      0,
    );
  } finally {
    t.close();
  }
});
test("plain-text limits reject contact details; messages expire and calling cannot be invoked", async () => {
  for (const bad of [
    "",
    "<script>",
    "https://evil.example",
    "mail@example.com",
    "+49 123 456 789",
    "x".repeat(281),
  ])
    assert.throws(() => cleanMessage(bad));
  assert.equal(cleanMessage("  Ciao!  "), "Ciao!");
  const t = setup();
  try {
    await t.call("a", { op: "enroll", confirm: true });
    await t.call("a", { op: "join-public", club: "cafe-club" });
    const room = "club:cafe-club:18+";
    await t.call("a", { op: "send", room, text: "Ciao!" });
    t.advance(31 * 86400000);
    assert.equal(
      (await t.call("a", { op: "messages", room })).messages.length,
      0,
    );
    await assert.rejects(t.call("a", { op: "call" }), /Unknown/);
  } finally {
    t.close();
  }
});

test("social IDs are site-scoped HMACs and moderator access is independent of analytics", async () => {
  const secret = "test-only-world-key-000000000000000000000";
  const de = await socialId("same-user", secret, "german"),
    it = await socialId("same-user", secret, "italian");
  assert.notEqual(de, it);
  assert.equal(await socialId("same-user", secret, "german"), de);
  await assert.rejects(socialId("same-user", "short"));
  assert.equal(
    isModerator({ userId: "a", email: "analytics@example.invalid" }, undefined),
    false,
  );
  assert.equal(isModerator({ userId: "a" }, "b, a"), true);
});

test("existing social graphs migrate transactionally without losing friend rooms or exposing old IDs", async () => {
  const t = setup();
  try {
    const owners = ["supabase:old-a", "supabase:old-b"],
      old = await Promise.all(owners.map((x) => digest(x + ":world")));
    const ids = await Promise.all(
      owners.map((x) =>
        socialId(x, "test-only-migration-secret-0000000000000000"),
      ),
    );
    const pair = [...old].sort().join(":");
    for (let i = 0; i < 2; i++)
      t.sql
        .prepare(
          "INSERT INTO world_people VALUES(?, '18+', ?, ?, 9999999999999,1,1)",
        )
        .run(old[i], "Alias" + i, "invite" + i);
    t.sql
      .prepare("INSERT INTO world_friends VALUES(?,?,?,?,?,1)")
      .run(pair, old[0], old[1], old[0], "accepted");
    t.sql
      .prepare("INSERT INTO world_messages VALUES('m',?,?, 'hello',1,0)")
      .run("friend:" + pair, old[0]);
    t.sql
      .prepare(
        "INSERT INTO world_rooms VALUES(?,?, '18+','club','code',9999999999999)",
      )
      .run("private:" + old[0], old[0]);
    t.sql
      .prepare("INSERT INTO world_members VALUES(?,?,?)")
      .run("private:" + old[0] + ":" + old[1], "private:" + old[0], old[1]);
    await ensureSocialIds(
      t.db,
      ids[0],
      "test-only-migration-secret-0000000000000000",
    );
    const friend = t.sql.prepare("SELECT * FROM world_friends").get();
    assert.equal(friend.id, [...ids].sort().join(":"));
    assert.equal(
      t.sql.prepare("SELECT room FROM world_messages WHERE id='m'").get().room,
      "friend:" + friend.id,
    );
    assert.equal(
      t.sql.prepare("SELECT owner FROM world_rooms").get().owner,
      ids[0],
    );
    assert.equal(
      t.sql.prepare("SELECT person FROM world_members").get().person,
      ids[1],
    );
    await migrateSocialId(t.db, owners[0], ids[0]);
  } finally {
    t.close();
  }
});
