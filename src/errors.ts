/**
 * Base class for every error thrown by the DrugCentral client.
 *
 * All client errors extend this class, so `instanceof DrugCentralError` is a
 * reliable way to distinguish API failures from unrelated runtime errors.
 */
export class DrugCentralError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DrugCentralError";
    // Restore prototype chain after a super() call with options (TS quirk).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** A non-2xx response from the DrugCentral API. */
export class DrugCentralApiError extends DrugCentralError {
  /** HTTP status code returned by the server. */
  readonly status: number;
  /** Raw response body for debugging. */
  readonly body: string;
  /** The URL that was requested. */
  readonly url: string;

  constructor(params: { status: number; body: string; url: string }) {
    super(
      `DrugCentral API error ${params.status} for ${params.url}: ${excerpt(params.body, 200)}`,
    );
    this.name = "DrugCentralApiError";
    this.status = params.status;
    this.body = params.body;
    this.url = params.url;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A 2xx response whose body is not JSON. DrugCentral's API transiently
 * returns non-JSON "Internal…" bodies with success or error status codes;
 * this error preserves that behavior instead of crashing on `JSON.parse`.
 */
export class DrugCentralInvalidResponseError extends DrugCentralError {
  /** The URL that was requested. */
  readonly url: string;
  /** Leading excerpt of the non-JSON body (capped length). */
  readonly bodyExcerpt: string;

  constructor(params: { url: string; body: string }) {
    const bodyExcerpt = excerpt(params.body, 200);
    super(
      `DrugCentral returned a non-JSON body for ${params.url}: ${bodyExcerpt}`,
    );
    this.name = "DrugCentralInvalidResponseError";
    this.url = params.url;
    this.bodyExcerpt = bodyExcerpt;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A request that exceeded the configured `timeoutMs` and was aborted via
 * `AbortController`.
 */
export class DrugCentralTimeoutError extends DrugCentralError {
  /** The configured timeout in milliseconds. */
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`DrugCentral request timed out after ${timeoutMs}ms`);
    this.name = "DrugCentralTimeoutError";
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * A network-level failure that prevented the request from completing (DNS
 * failure, connection reset, etc.). The transport error is attached as
 * `cause`.
 */
export class DrugCentralNetworkError extends DrugCentralError {
  /** The URL that was requested. */
  readonly url: string;

  constructor(url: string, cause: unknown) {
    super(`DrugCentral network failure for ${url}`, { cause });
    this.name = "DrugCentralNetworkError";
    this.url = url;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Caps a body excerpt for error messages. */
function excerpt(body: string, maxLength: number): string {
  const flat = body.replaceAll(/\s+/g, " ").trim();
  return flat.length <= maxLength ? flat : `${flat.slice(0, maxLength)}…`;
}
