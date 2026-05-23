export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const api = {
  get: (path: string) => fetch(`${BASE}${path}`).then((r) => r.json()),
  post: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  put: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  patch: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
  delete: (path: string) =>
    fetch(`${BASE}${path}`, { method: "DELETE" }).then((r) => r.json()),
  upload: (path: string, formData: FormData) =>
    fetch(`${BASE}${path}`, { method: "POST", body: formData }).then((r) => r.json()),
  stream: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
