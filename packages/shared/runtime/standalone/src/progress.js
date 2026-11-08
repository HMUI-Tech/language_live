import { LANGUAGE_SCHEMA } from "../../lib/language-config.mjs";
import { diffDocs } from "./delta.js";
export function makeProgressClient(client) {
  let boundUserId = null,
    acknowledged = null;
  async function userId() {
    if (!client) throw new Error("Sign in to save progress.");
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error("Please sign in again.");
    if (boundUserId && boundUserId !== data.user.id)
      throw new Error("Account changed. Reload before saving progress.");
    boundUserId = data.user.id;
    return data.user.id;
  }
  return {
    async load() {
      await userId();
      const { data, error } = await client.rpc(
        `get_${LANGUAGE_SCHEMA}_progress`,
      );
      if (error) throw new Error("Could not load your progress.");
      acknowledged = data?.docs ? structuredClone(data.docs) : null;
      return data || { docs: null, revision: 0 };
    },
    async save(docs, revision) {
      await userId();
      const delta = acknowledged ? diffDocs(acknowledged, docs) : null;
      if (delta && !Object.keys(delta.changed).length && !delta.removed.length)
        return { revision };
      const { data, error } = await client.rpc(
        delta
          ? `patch_${LANGUAGE_SCHEMA}_progress`
          : `save_${LANGUAGE_SCHEMA}_progress`,
        delta
          ? {
              changed_docs: delta.changed,
              removed_docs: delta.removed,
              expected_revision: revision,
            }
          : { new_docs: docs, expected_revision: revision },
      );
      if (error) {
        const conflict = error.message?.includes("progress_conflict");
        const failure = new Error(
          conflict
            ? "Progress changed on another device. Export this copy and reload."
            : "Could not save progress. Please retry.",
        );
        failure.conflict = conflict;
        throw failure;
      }
      acknowledged = structuredClone(docs);
      return { revision: data };
    },
  };
}
