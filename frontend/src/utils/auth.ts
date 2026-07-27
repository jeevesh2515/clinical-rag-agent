/**
 * Read the body's `detail` field for a non-OK response, falling back to a
 * human-readable status-derived string for 401/403 and when the body is
 * not JSON. Shared by LoginPage and SignupPage so the auth error surface
 * is consistent across both flows.
 *
 * ``prefix`` is used to construct the rare non-JSON 5xx tail (e.g.
 * "Login failed: HTTP 500", "Registration failed: HTTP 502"). Keeping the
 * page-specific verb helps log filters and dashboards keying off the
 * surface string.
 */
export async function safeReadErrorDetail(
  res: Response,
  fallback: string,
  prefix: string = 'Request',
): Promise<string> {
  if (res.status === 401 || res.status === 403) return fallback
  try {
    const body = await res.json()
    if (body && typeof body.detail === 'string') return body.detail
  } catch {
    /* body wasn't JSON; fall through to status-derived message */
  }
  return `${prefix} failed: HTTP ${res.status}`
}

/**
 * Map a thrown fetch / Response error into a user-friendly banner. Network
 * errors and 5xx / 408 / 429 responses get a single retry-oriented
 * message so users don't see raw "Failed to fetch" / "Load failed" /
 * "Too Many Requests" text. Authentication errors (400/401/403) and
 * application-level messages pass through unchanged.
 */
export function formatAuthError(raw: string): string {
  const lower = raw.toLowerCase()
  if (
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('http 408') ||
    lower.includes('http 429') ||
    lower.includes('http 500') ||
    lower.includes('http 502') ||
    lower.includes('http 503') ||
    lower.includes('http 504') ||
    lower.includes('typeerror')
  ) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  return raw
}
