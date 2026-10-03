import { describe, expect, test } from "vitest";
import { paginateAll } from "../src/pagination";
import { DEFAULT_PAGE_SIZE } from "../src/constants";

describe("paginateAll", () => {
  test("walks pages until a short page arrives", async () => {
    const calls: Array<[number, number]> = [];
    const fetchPage = (skip: number, limit: number) => {
      calls.push([skip, limit]);
      if (skip === 0) return Promise.resolve([1, 2, 3] as number[]);
      if (skip === 3) return Promise.resolve([4, 5] as number[]); // short page
      throw new Error("unreachable");
    };
    const out: number[] = [];
    for await (const row of paginateAll(fetchPage, { pageSize: 3 })) {
      out.push(row);
    }
    expect(out).toEqual([1, 2, 3, 4, 5]);
    expect(calls).toEqual([
      [0, 3],
      [3, 3],
    ]);
  });

  test("treats an unhonored-limit dump as complete and never loops", async () => {
    let calls = 0;
    const fetchPage = (skip: number, limit: number) => {
      calls += 1;
      expect(skip).toBe(0);
      // Upstream ignored the requested limit of 2 and sent the whole table.
      return Promise.resolve(Array.from({ length: 50 }, (_, i) => i));
    };
    const out: number[] = [];
    for await (const row of paginateAll(fetchPage, { pageSize: 2 })) {
      out.push(row);
    }
    expect(out).toHaveLength(50);
    expect(calls).toBe(1);
  });

  test("stops after maxPages even when pages stay full", async () => {
    const fetchPage = () =>
      Promise.resolve([1, 2, 3] as number[]); // always a "full" page
    const out: number[] = [];
    for await (const row of paginateAll(fetchPage, {
      pageSize: 3,
      maxPages: 2,
    })) {
      out.push(row);
    }
    // 6 rows = two pages; iteration stopped without claiming completeness.
    expect(out).toEqual([1, 2, 3, 1, 2, 3]);
  });

  test("yields nothing for an empty first page", async () => {
    const out: number[] = [];
    for await (const row of paginateAll(() => Promise.resolve([]), {
      pageSize: 10,
    })) {
      out.push(row);
    }
    expect(out).toEqual([]);
  });

  test("defaults to DEFAULT_PAGE_SIZE", async () => {
    let observedLimit = 0;
    const fetchPage = (_skip: number, limit: number) => {
      observedLimit = limit;
      return Promise.resolve([1] as number[]);
    };
    for await (const _row of paginateAll(fetchPage)) {
      break;
    }
    expect(observedLimit).toBe(DEFAULT_PAGE_SIZE);
  });

  test("rejects invalid pageSize eagerly, not on first next()", () => {
    expect(() =>
      paginateAll(() => Promise.resolve([]), { pageSize: 0 })[Symbol.asyncIterator](),
    ).toThrow(RangeError);
  });
});
