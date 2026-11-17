export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001/api";

export class ApiError extends Error {}

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
        "Content-Type": "application/json",
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
    throw new ApiError(msg || "Something went wrong. Please try again.");
  }
  return body as T;
}

export const TOKEN_KEY = "msp_board_token";
