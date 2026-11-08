/** Changes are whole progress documents/chunks, never arbitrary JSON paths. */
const allowed = (key) =>
  key === "meta" || key === "custom" || /^cards-[\w-]+$/.test(key);
export function diffDocs(previous, next) {
  const changed = {},
    removed = [];
  for (const [key, value] of Object.entries(next)) {
    if (!allowed(key)) throw Error("Unknown progress document.");
    if (JSON.stringify(previous?.[key]) !== JSON.stringify(value))
      changed[key] = value;
  }
  for (const key of Object.keys(previous || {}))
    if (!(key in next)) removed.push(key);
  return { changed, removed };
}
export function mergeDocs(previous, patch) {
  if (
    !patch ||
    typeof patch.changed !== "object" ||
    patch.changed === null ||
    Array.isArray(patch.changed) ||
    !Array.isArray(patch.removed) ||
    patch.removed.length > 500
  )
    throw Error("Invalid progress changes.");
  const result = { ...previous };
  for (const [key, value] of Object.entries(patch.changed)) {
    if (
      !allowed(key) ||
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    )
      throw Error("Invalid progress document.");
    result[key] = value;
  }
  for (const key of patch.removed) {
    if (
      typeof key !== "string" ||
      !allowed(key) ||
      ["meta", "custom"].includes(key)
    )
      throw Error("Cannot remove required progress documents.");
    delete result[key];
  }
  return result;
}
