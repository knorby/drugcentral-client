import type { QueryParamValue } from "../http";

/**
 * Serializes query parameters, skipping `undefined` values and
 * percent-encoding everything else. Returns `""` when nothing remains.
 */
export function buildQueryString(
  params: Record<string, QueryParamValue>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  return parts.join("&");
}
