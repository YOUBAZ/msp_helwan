export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api";

export class ApiError extends Error {
  /** HTTP status from the server, or 0 if the server couldn't be reached. */
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        // Let the browser set the multipart boundary for file uploads.
        ...(rest.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach the server. Please try again later.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new ApiError(msg || "Something went wrong. Please try again.", res.status);
  }
  return body as T;
}

export const TOKEN_KEY = "msp_board_token";

/** Full URL for an API-relative path such as a profile photo. */
export const apiUrl = (path: string) => `${API_URL}${path}`;
