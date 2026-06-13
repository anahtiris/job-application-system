export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** Thrown for any non-2xx response. Carries the HTTP status and the
 *  backend's `detail` message (FastAPI) when one is present. */
export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `Request failed (HTTP ${status})`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function parse(r: Response) {
  if (!r.ok) {
    let detail = "";
    try {
      const data = await r.json();
      detail =
        typeof data?.detail === "string"
          ? data.detail
          : JSON.stringify(data?.detail ?? data);
    } catch {
      try {
        detail = await r.text();
      } catch {
        /* no body */
      }
    }
    throw new ApiError(r.status, detail);
  }
  if (r.status === 204) return null;
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

const withBody =
  (method: "POST" | "PUT" | "PATCH") => (path: string, body?: unknown) =>
    fetch(`${BASE}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(parse);

export const api = {
  get: (path: string) => fetch(`${BASE}${path}`).then(parse),
  post: withBody("POST"),
  put: withBody("PUT"),
  patch: withBody("PATCH"),
  delete: (path: string) =>
    fetch(`${BASE}${path}`, { method: "DELETE" }).then(parse),
  upload: (path: string, formData: FormData) =>
    fetch(`${BASE}${path}`, { method: "POST", body: formData }).then(parse),
  // SSE / streaming — returns the raw Response; caller checks `.ok` and reads the body.
  stream: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
