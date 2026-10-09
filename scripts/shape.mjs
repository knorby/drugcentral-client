/**
 * Structural shape helpers shared by the drift tooling.
 *
 * The shape of a record is its skeleton with no values:
 *   - objects  → { key: shape } with sorted keys
 *   - arrays   → [shape of the merged union of all elements]
 *   - scalars  → "string" | "number" | "boolean" | "null" | "mixed"
 */
export function shapeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return [shapeOfRecord(value)];
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = shapeOf(value[key]);
    }
    return out;
  }
  return typeof value;
}

/** Shape of an array: the merged union of every element's shape. */
export function shapeOfRecord(array) {
  let merged;
  for (const element of array) {
    const s = shapeOf(element);
    merged = merged === undefined ? s : mergeShapes(merged, s);
  }
  return merged ?? "null";
}

/**
 * Merges two shapes: object keys unite, nested arrays merge, differing
 * scalars widen to "mixed" (objects beat scalars).
 */
export function mergeShapes(a, b) {
  if (a === b) return a;
  const bothObjects = typeof a === "object" && typeof b === "object";
  if (bothObjects && !Array.isArray(a) && !Array.isArray(b)) {
    const out = { ...a };
    for (const [key, bShape] of Object.entries(b)) {
      out[key] = key in a ? mergeShapes(a[key], bShape) : bShape;
    }
    return out;
  }
  const bothArrays = Array.isArray(a) && Array.isArray(b);
  if (bothArrays) {
    return [mergeShapes(a[0], b[0])];
  }
  const objectSide = [a, b].find(
    (s) => typeof s === "object" && !Array.isArray(s),
  );
  return objectSide ?? "mixed";
}
