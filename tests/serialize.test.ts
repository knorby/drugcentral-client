import { describe, expect, test } from "vitest";
import { buildQueryString } from "../src/utils/serialize";

describe("buildQueryString", () => {
  test("encodes keys and values", () => {
    expect(buildQueryString({ q: "a b&c", n: 5 })).toBe(
      `q=${encodeURIComponent("a b&c")}&n=5`,
    );
  });

  test("skips undefined values", () => {
    expect(buildQueryString({ a: 1, b: undefined, c: 2 })).toBe("a=1&c=2");
  });

  test("returns empty string when nothing remains", () => {
    expect(buildQueryString({ a: undefined })).toBe("");
    expect(buildQueryString({})).toBe("");
  });
});
