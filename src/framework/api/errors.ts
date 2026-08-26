// ApiError + envelope normalization. Ported from the Godot F0 (core/error_envelope.gd
// + core/api_result.gd). The backend's CURRENT flat envelope ({"error":"msg"}) and
// the LIVE structured one ({"error":{code,message,redirectUrl}}) both collapse to a
// single ApiError, so callers are written once (PRD §8.3).

// Internal code vocabulary the rest of the app switches on.
export type ApiErrorCode =
  | "NETWORK" // transport failure / timeout / no response
  | "INVALID_TOKEN" // 401 — trigger one silent refresh, then login
  | "NOT_REGISTERED" // 403 with that code (future backend; today Firebase EMAIL_NOT_FOUND)
  | "FORBIDDEN" // 403 without NOT_REGISTERED (e.g. admin-only)
  | "NOT_FOUND" // 404
  | "BAD_REQUEST" // 400 (e.g. result-kind mismatch on submit)
  | "INSUFFICIENT_FUNDS"
  | "ITEM_LOCKED"
  | "NOT_OWNED"
  | "SERVER_ERROR" // 5xx
  | "BAD_RESPONSE" // 2xx body failed schema validation
  | "HTTP_ERROR"; // any other non-2xx

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  readonly redirectUrl: string;
  /**
   * The parsed response body, when there was one.
   *
   * Most callers want the code and the message and nothing else. The exception
   * is a 409 from the state endpoints, which carries the server's current
   * document precisely so the client can resolve without a second round trip —
   * discarding it here would make that impossible.
   */
  readonly body: unknown;

  constructor(
    code: ApiErrorCode,
    message: string,
    httpStatus = 0,
    redirectUrl = "",
    body: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.redirectUrl = redirectUrl;
    this.body = body;
  }

  isAuthError(): boolean {
    return this.code === "INVALID_TOKEN";
  }
}

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "INVALID_TOKEN";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    default:
      return status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR";
  }
}

function defaultMessageForStatus(status: number): string {
  switch (status) {
    case 401:
      return "Your session expired.";
    case 403:
      return "You don't have access to that.";
    case 404:
      return "Not found.";
    default:
      return status >= 500
        ? "The city's services are having a moment. Retrying…"
        : `Something went wrong (${status}).`;
  }
}

const KNOWN_CODES = new Set<string>([
  "NOT_REGISTERED",
  "FORBIDDEN",
  "INSUFFICIENT_FUNDS",
  "ITEM_LOCKED",
  "NOT_OWNED",
  "BAD_REQUEST",
  "NOT_FOUND",
]);

/**
 * Normalize a non-2xx response body into an ApiError.
 * Handles the flat ({"error":"msg"}) and structured ({"error":{code,message,
 * redirectUrl}}) envelopes. Auth is STATUS-driven: any 401 → INVALID_TOKEN,
 * whatever the body label — the LIVE backend sends code "UNAUTHENTICATED", and
 * silent-refresh must still fire (verified against Cloud Run in the Godot F0).
 */
export function parseEnvelope(status: number, body: unknown): ApiError {
  let code = codeForStatus(status);
  let message = defaultMessageForStatus(status);
  let redirect = "";

  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string") {
      message = err; // flat envelope
    } else if (err && typeof err === "object") {
      const e = err as { code?: unknown; message?: unknown; redirectUrl?: unknown };
      if (typeof e.code === "string" && KNOWN_CODES.has(e.code)) code = e.code as ApiErrorCode;
      if (typeof e.message === "string") message = e.message;
      if (typeof e.redirectUrl === "string") redirect = e.redirectUrl;
    }
  }

  if (status === 401) code = "INVALID_TOKEN"; // status-driven auth (see docstring)
  return new ApiError(code, message, status, redirect, body);
}
