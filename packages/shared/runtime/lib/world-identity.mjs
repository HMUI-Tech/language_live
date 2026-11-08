import { LANGUAGE_SCHEMA } from "./language-config.mjs";
import { digest } from "./family.mjs";
export async function publicIdFromLegacy(
  legacy,
  secret,
  language = LANGUAGE_SCHEMA,
) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("World identity configuration missing");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(language + ":world:v2:" + legacy),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function socialId(owner, secret, language = LANGUAGE_SCHEMA) {
  return publicIdFromLegacy(await digest(owner + ":world"), secret, language);
}
export async function ensureSocialIds(db, id, secret) {
  await db
    .prepare("INSERT OR IGNORE INTO world_identity_versions(id) VALUES(?)")
    .bind(id)
    .run();
  if (
    await db
      .prepare("SELECT id FROM world_maintenance WHERE id='identity-v2'")
      .bind()
      .first()
  )
    return;
  // One-time upgrade, resumable after an interrupted request. All legacy peers are
  // migrated before any social data is returned, including peers who have not logged in.
  for (;;) {
    const page = await db
      .prepare(
        "SELECT p.id FROM world_people p LEFT JOIN world_identity_versions v ON v.id=p.id WHERE v.id IS NULL LIMIT 100",
      )
      .bind()
      .all();
    if (!page.results.length) break;
    for (const person of page.results)
      await migrateLegacySocialId(
        db,
        person.id,
        await publicIdFromLegacy(person.id, secret),
      );
  }
  await db
    .prepare(
      "INSERT OR IGNORE INTO world_maintenance(id,last_cleanup) VALUES('identity-v2',0)",
    )
    .bind()
    .run();
}
export function isModerator(user, configured) {
  return (
    !!user?.userId &&
    String(configured || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .includes(user.userId)
  );
}
// Lazy one-time migration. D1 batches are transactional: no partially migrated graph.
export async function migrateSocialId(db, owner, id) {
  const old = await digest(owner + ":world");
  return migrateLegacySocialId(db, old, id);
}
async function migrateLegacySocialId(db, old, id) {
  if (
    !(await db
      .prepare("SELECT id FROM world_people WHERE id=?")
      .bind(old)
      .first())
  )
    return;
  const statements = [];
  const fields = {
    world_people: ["id"],
    world_friends: ["a", "b", "requester"],
    world_blocks: ["blocker", "blocked"],
    world_rooms: ["id", "owner"],
    world_members: ["id", "room", "person"],
    world_messages: ["room", "sender"],
    world_reports: ["reporter"],
    world_bans: ["id"],
  };
  for (const [table, columns] of Object.entries(fields))
    for (const column of columns)
      statements.push(
        db
          .prepare(
            `UPDATE ${table} SET ${column}=replace(${column},?,?) WHERE instr(${column},?)>0`,
          )
          .bind(old, id, old),
      );
  statements.push(
    db
      .prepare(
        "UPDATE world_friends SET id=CASE WHEN a<b THEN a||':'||b ELSE b||':'||a END WHERE a=? OR b=?",
      )
      .bind(id, id),
  );
  statements.push(
    db
      .prepare(
        "UPDATE world_blocks SET id=(CASE WHEN blocker<blocked THEN blocker||':'||blocked ELSE blocked||':'||blocker END)||':'||blocker WHERE blocker=? OR blocked=?",
      )
      .bind(id, id),
  );
  statements.push(
    db
      .prepare(
        "UPDATE world_messages SET room='friend:'||substr(room,73,64)||':'||substr(room,8,64) WHERE room LIKE 'friend:%' AND instr(room,?)>0 AND substr(room,8,64)>substr(room,73,64)",
      )
      .bind(id),
  );
  statements.push(
    db
      .prepare("INSERT OR IGNORE INTO world_identity_versions(id) VALUES(?)")
      .bind(id),
  );
  await db.batch(statements);
}
