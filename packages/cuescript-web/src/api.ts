// Every change goes through the HTTP API; the WebSocket only pushes state back.
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return reply<T>(res);
}

// sends a file as the request body, as the script import expects
export async function upload<T = unknown>(method: string, path: string, file: File): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/octet-stream" },
    body: file,
  });
  return reply<T>(res);
}

async function reply<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
