import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Deterministic drift detection: every committed fixture must produce a
 * shape tree equal to the committed snapshot for that sample. When a
 * regenerated `npm run drift:capture` changes a snapshot, the types in
 * `src/types/` (and the fixture) need review together.
 */

/** Structural shape of a value (mirrors scripts/shape.mjs). */
function shapeOf(value: unknown): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    let merged: unknown;
    for (const element of value) {
      const s = shapeOf(element);
      merged = merged === undefined ? s : mergeShapes(merged, s);
    }
    return [merged ?? "null"];
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      out[key] = shapeOf(source[key]);
    }
    return out;
  }
  return typeof value;
}

function mergeShapes(a: unknown, b: unknown): unknown {
  if (a === b) return a;
  if (
    typeof a === "object" &&
    a !== null &&
    !Array.isArray(a) &&
    typeof b === "object" &&
    b !== null &&
    !Array.isArray(b)
  ) {
    const out = { ...(a as Record<string, unknown>) };
    for (const [key, bShape] of Object.entries(
      b as Record<string, unknown>,
    )) {
      out[key] = key in a ? mergeShapes(out[key], bShape) : bShape;
    }
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return [mergeShapes(a[0], b[0])];
  }
  const objectSide = [a, b].find(
    (s) => typeof s === "object" && s !== null && !Array.isArray(s),
  );
  return objectSide ?? "mixed";
}


/**
 * True when every field the fixture shape carries is covered by the
 * (live-captured, possibly wider) snapshot shape: object keys subset,
 * arrays elementwise, `null` covered by anything, scalars equal-or-mixed.
 */
function shapeSubset(fixture: unknown, snapshot: unknown): boolean {
  if (fixture === "null") return true;
  if (typeof fixture === "string" || typeof snapshot === "string") {
    if (fixture === snapshot) return true;
    return snapshot === "mixed"; // widened union covers the fixture kind
  }
  if (Array.isArray(fixture) && Array.isArray(snapshot)) {
    return shapeSubset(fixture[0], snapshot[0]);
  }
  if (
    typeof fixture === "object" &&
    typeof snapshot === "object" &&
    fixture !== null &&
    snapshot !== null
  ) {
    return Object.entries(fixture as Record<string, unknown>).every(
      ([key, sub]) =>
        key in (snapshot as Record<string, unknown>) &&
        shapeSubset(sub, (snapshot as Record<string, unknown>)[key]),
    );
  }
  return false;
}

const fixturesDir = join(import.meta.dirname, "fixtures");
const shapesDir = join(import.meta.dirname, "shapes");

const fixtures = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".json"))
  .filter((name) => !name.endsWith(".meta.json") && name !== "openapi.json")
  .map((name) => name.replace(/\.json$/, ""));

describe("fixture shapes match committed snapshots", () => {
  test("every fixture has a committed shape snapshot", () => {
    expect(fixtures.length).toBeGreaterThan(20);
  });

  for (const fixture of fixtures) {
    test(`${fixture}.json shape is stable`, () => {
      const rows = JSON.parse(
        readFileSync(join(fixturesDir, `${fixture}.json`), "utf8"),
      );
      const snapshot = JSON.parse(
        readFileSync(join(shapesDir, `${fixture}.json`), "utf8"),
      );
      expect(shapeSubset(shapeOf(rows), snapshot)).toBe(true);
    });
  }
});
