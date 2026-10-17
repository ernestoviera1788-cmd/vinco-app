/**
 * Low-level RPC client for the VINCÓ backend.
 *
 * Transport (from BACKEND_CONTRACT.md):
 *   POST {BASE}/actions
 *   body: {"action":"<lowercase>","args":{"token":"<session-token>",...},"actionCallId":"<uuid>"}
 *   header: Content-Type: application/json
 *
 * Success = HTTP 200 {"data": <payload>}
 * Business error = HTTP 200 {"data":{"ok":false,"error":"..."}}
 * The session token travels INSIDE args, never as an Authorization header.
 */

const FALLBACK_BASE = 'https://vinco-server-production.up.railway.app';
const RAW_BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
// Startup breadcrumb: visible in the Expo terminal on reload.
console.log('[vinco] API BASE =', RAW_BASE === '' ? '(fallback)' : RAW_BASE);
// Never let an empty or placeholder URL reach the network: fall back to production.
const BASE = RAW_BASE === '' || RAW_BASE.includes('example.com') ? FALLBACK_BASE : RAW_BASE;

export function apiBaseUrl(): string {
  return BASE;
}

export function isApiConfigured(): boolean {
  return BASE.length > 0;
}

/** Business-logic error returned by the backend (HTTP 200 envelope). */
export class ApiError extends Error {
  readonly code: string;
  constructor(message: string, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/**
 * Thrown when the backend rejects the session token. AuthContext catches this
 * and forces a logout back to the login screen.
 */
export class AuthError extends ApiError {
  constructor(message = 'Session expired. Please log in again.') {
    super(message, 'AUTH');
    this.name = 'AuthError';
  }
}

/** Listener invoked right before an AuthError is thrown, so AuthContext can log out. */
let authFailureListener: (() => void) | null = null;
export function onAuthFailure(fn: (() => void) | null): void {
  authFailureListener = fn;
}

function uuidv4(): string {
  // RFC 4122 v4, Math.random-based (used only as an idempotency key).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const AUTH_ERROR_HINTS = [
  'unauthorized',
  'invalid token',
  'invalid_token',
  'expired',
  'session',
  'not authenticated',
  'login required',
  'forbidden',
];

function looksLikeAuthFailure(message: string): boolean {
  const m = message.toLowerCase();
  return AUTH_ERROR_HINTS.some((h) => m.includes(h));
}

export interface CallOptions {
  /** Session token — injected into `args.token` by this client. */
  token?: string;
  timeoutMs?: number;
}

/**
 * Call one RPC action. Never invents action names — callers in `actions.ts`
 * pass only actions documented in BACKEND_CONTRACT.md.
 */
export async function callAction<T = unknown>(
  action: string,
  args: Record<string, unknown> = {},
  opts: CallOptions = {},
): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(
      'Backend URL is not configured. Set EXPO_PUBLIC_API_URL in your .env and restart the app.',
      'NOT_CONFIGURED',
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25000);

  let res: Response;
  try {
    res = await fetch(`${BASE}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        action,
        args: opts.token ? { token: opts.token, ...args } : args,
        actionCallId: uuidv4(),
      }),
    });
  } catch (e) {
    throw new ApiError(
      e instanceof Error && e.name === 'AbortError'
        ? 'Request timed out. Check your connection and try again.'
        : 'Network error. Check your connection and try again.',
      'NETWORK',
    );
  } finally {
    clearTimeout(timer);
  }

  let envelope: unknown = null;
  try {
    envelope = await res.json();
  } catch {
    throw new ApiError(`Server returned an unreadable response (HTTP ${res.status}).`, 'BAD_RESPONSE');
  }

  if (!res.ok) {
    const serverMsg =
      typeof envelope === 'object' && envelope !== null && 'error' in envelope
        ? String((envelope as { error: unknown }).error)
        : `Request failed (HTTP ${res.status}).`;
    // HTTP 401/403 are themselves auth failures: the contract requires a forced
    // logout on expired/invalid token even when the body carries no recognizable
    // auth message (e.g. empty body or HTML error page).
    if (res.status === 401 || res.status === 403 || looksLikeAuthFailure(serverMsg)) {
      authFailureListener?.();
      throw new AuthError(looksLikeAuthFailure(serverMsg) ? serverMsg : undefined);
    }
    throw new ApiError(serverMsg, 'TRANSPORT');
  }

  const data =
    typeof envelope === 'object' && envelope !== null && 'data' in envelope
      ? (envelope as { data: unknown }).data
      : undefined;

  if (
    typeof data === 'object' &&
    data !== null &&
    (data as { ok?: unknown }).ok === false
  ) {
    const message =
      typeof (data as { error?: unknown }).error === 'string' &&
      (data as { error: string }).error.length > 0
        ? (data as { error: string }).error
        : 'Something went wrong.';
    if (looksLikeAuthFailure(message)) {
      authFailureListener?.();
      throw new AuthError(message);
    }
    throw new ApiError(message, 'BUSINESS');
  }

  return data as T;
}
