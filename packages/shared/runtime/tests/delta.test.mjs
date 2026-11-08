import test from "node:test";
import assert from "node:assert/strict";
import { diffDocs, mergeDocs } from "../standalone/src/delta.js";
import { makeProgressClient } from "../standalone/src/progress.js";
test("only changed progress chunks travel and deletions survive import replacement", () => {
  const before = {
      meta: { v: 1, settings: {} },
      custom: { items: {} },
      "cards-a": { cards: { a: { reps: 1 } } },
      "cards-b": { cards: { b: { reps: 2 } } },
    },
    after = structuredClone(before);
  after["cards-a"].cards.a.reps = 2;
  const patch = diffDocs(before, after);
  assert.deepEqual(Object.keys(patch.changed), ["cards-a"]);
  assert.deepEqual(mergeDocs(before, patch), after);
  delete after["cards-b"];
  assert.deepEqual(diffDocs(before, after).removed, ["cards-b"]);
  assert.deepEqual(mergeDocs(before, diffDocs(before, after)), after);
  assert.throws(() => mergeDocs(before, { changed: {}, removed: ["meta"] }));
  assert.throws(() =>
    mergeDocs(before, { changed: { __bad: {} }, removed: [] }),
  );
});
test("acknowledged snapshots advance only after a successful patch and no-op saves do not write", async () => {
  let fail = false,
    writes = 0,
    seen;
  const docs = {
    meta: { v: 1, settings: {} },
    custom: { items: {} },
    "cards-a": { cards: { a: { reps: 1 } } },
  };
  const client = makeProgressClient({
    auth: { getUser: async () => ({ data: { user: { id: "a" } } }) },
    rpc: async (name, args) => {
      if (name.startsWith("get_"))
        return { data: { docs: structuredClone(docs), revision: 1 } };
      writes++;
      seen = { name, args };
      return fail ? { error: { message: "progress_conflict" } } : { data: 2 };
    },
  });
  await client.load();
  await client.save(docs, 1);
  assert.equal(writes, 0);
  const next = structuredClone(docs);
  next["cards-a"].cards.a.reps = 2;
  fail = true;
  await assert.rejects(client.save(next, 1), (e) => e.conflict);
  fail = false;
  await client.save(next, 1);
  assert(seen.name.startsWith("patch_"));
  assert.deepEqual(Object.keys(seen.args.changed_docs), ["cards-a"]);
  await client.save(next, 2);
  assert.equal(writes, 2);
});
