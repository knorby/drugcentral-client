/**
 * Test helpers: a queued-response `fetch` mock that records every requested
 * URL and init, following the openfda-client house pattern.
 */

/** A queued item: a full `Response`, a descriptor, or a plain JSON value (200). */
export type QueuedResponse =
  | Response
  | { status: number; body?: string; contentType?: string }
  | unknown;

/** Builds a `Response` from a queue item. */
function toResponse(item: QueuedResponse): Response {
  if (item instanceof Response) return item;
  if (
    typeof item === "object" &&
    item !== null &&
    "status" in item &&
    typeof (item as { status: unknown }).status === "number"
  ) {
    const desc = item as {
      status: number;
      body?: string;
      contentType?: string;
    };
    return new Response(desc.body ?? "", {
      status: desc.status,
      headers: {
        ...(desc.contentType === undefined
          ? {}
          : { "Content-Type": desc.contentType }),
      },
    });
  }
  return new Response(JSON.stringify(item), {
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * A queued-response fetch mock. Each call consumes the next queued item (the
 * last item repeats once the queue is exhausted). Records requested URLs and
 * inits. Pass a function for dynamic responses.
 */
export function queuedFetch(
  responses: QueuedResponse[] | (() => QueuedResponse),
) {
  const urls: string[] = [];
  const inits: RequestInit[] = [];
  let call = 0;
  const fn = (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url));
    inits.push(init ?? {});
    const item =
      typeof responses === "function"
        ? (responses as () => QueuedResponse)()
        : responses[Math.min(call, responses.length - 1)];
    call += 1;
    return Promise.resolve(toResponse(item));
  };
  return { fetch: fn as unknown as typeof fetch, urls, inits };
}

/**
 * A fetch mock that never resolves until the request's `signal` aborts, then
 * rejects with the signal's `reason` (mirrors real `fetch` abort semantics).
 */
export function hangingFetch() {
  const urls: string[] = [];
  const fn = (url: string | URL | Request, init?: RequestInit) => {
    urls.push(String(url));
    const signal = init?.signal as AbortSignal;
    return new Promise<Response>((_, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  };
  return { fetch: fn as unknown as typeof fetch, urls };
}

/** A fetch mock that rejects like a transport-level (DNS/socket) failure. */
export function rejectingFetch(cause: unknown = new TypeError("fetch failed")) {
  const urls: string[] = [];
  const fn = (url: string | URL | Request) => {
    urls.push(String(url));
    return Promise.reject(cause);
  };
  return { fetch: fn as unknown as typeof fetch, urls };
}

/**
 * A fetch mock that routes by URL: keys are paths (query-string-free) and
 * values are JSON bodies. Unmatched paths return DrugCentral's no-match 404
 * (`{"detail":"… not found"}`), so guided 404-tolerance is exercisable.
 */
export function routingFetch(routes: Record<string, unknown>) {
  const urls: string[] = [];
  const fn = (url: string | URL | Request): Promise<Response> => {
    urls.push(String(url));
    const path = String(url).split("?")[0] ?? "";
    const base = path.replace(/^https?:\/\/[^/]+\/?/, "");
    const route =
      base in routes
        ? routes[base]
        : (() => {
            // URLs arrive percent-encoded; accept decoded keys too.
            try {
              const decoded = decodeURIComponent(base);
              return decoded in routes ? routes[decoded] : undefined;
            } catch {
              return undefined;
            }
          })();
    if (route !== undefined) {
      return Promise.resolve(
        new Response(JSON.stringify(route), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(
      new Response('{"detail":"not found"}', {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };
  return { fetch: fn as unknown as typeof fetch, urls };
}

