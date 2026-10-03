import { DEFAULT_PAGE_SIZE } from "./constants";

/** Options for {@link paginateAll}. */
export interface PaginateOptions {
  /**
   * Requested page size (`limit` per request). Upstream endpoints that ignore
   * `limit` will return everything in one dump; the paginator detects that
   * and stops after the first response.
   * @default 100
   */
  pageSize?: number;
  /**
   * Safety cap on the number of page requests. Iteration stops when reached
   * **without any claim of completeness** — a caller relying on exhaustive
   * coverage must compare yielded count against expectations itself.
   */
  maxPages?: number;
}

/**
 * Walks a DrugCentral list endpoint via `skip`/`limit`, yielding every row.
 *
 * Termination policy (matches observed upstream behavior):
 * - A response **longer than** the requested limit means the endpoint ignored
 *   the limit and returned a complete dump: yield everything, stop (never
 *   loop).
 * - A short page means the server has no more rows: stop.
 * - Otherwise advance `skip` by the rows received.
 * - `maxPages`, when set, stops iteration early — that stop is a labeled
 *   truncation, not proof of complete upstream coverage.
 *
 * Validation of `opts` throws eagerly at call time (a generator body would
 * defer it to the first `next()`).
 */
export function paginateAll<T>(
  fetchPage: (skip: number, limit: number) => Promise<T[]>,
  opts?: PaginateOptions,
): AsyncGenerator<T> {
  const pageSize = opts?.pageSize ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(
      `pageSize must be a positive integer, got ${String(pageSize)}`,
    );
  }
  if (
    opts?.maxPages !== undefined &&
    (!Number.isInteger(opts.maxPages) || opts.maxPages < 1)
  ) {
    throw new RangeError(
      `maxPages must be a positive integer, got ${String(opts.maxPages)}`,
    );
  }
  return (async function* (): AsyncGenerator<T> {
    let skip = 0;
    for (let page = 0; ; page += 1) {
      if (opts?.maxPages !== undefined && page >= opts.maxPages) return;
      const rows = await fetchPage(skip, pageSize);
      yield* rows;
      // Unhonored-limit dump or a short page: no more requests either way.
      if (rows.length !== pageSize) return;
      skip += rows.length;
    }
  })();
}
