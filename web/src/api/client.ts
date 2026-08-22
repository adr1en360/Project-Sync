/**
 * The one door to the service.
 *
 * Each call to the API goes through this module. A single door keeps the error
 * behaviour the same everywhere: a reply that is not OK becomes an `Error` that
 * holds the `detail` text of the service, because that text tells a person what
 * to do next.
 *
 * The paths have no host. The service sends the page and the API from one
 * origin, so a relative path is correct in the build. In development the Vite
 * proxy sends the same paths to the FastAPI process.
 */

export type Health = {
  status: string;
  model: string;
  use_vertex_ai: boolean;
  missing_config: string[];
};

/** Read the `detail` text of a failed reply. */
async function detailOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      const detail = (body as { detail: unknown }).detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
  } catch {
    // A reply with no JSON body is normal for some errors. The status text is
    // then the best text available.
  }
  return `${response.status} ${response.statusText}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(await detailOf(response));
  }
  return (await response.json()) as T;
}

/** Ask the service if it is up, and which settings are absent. */
export function getHealth(): Promise<Health> {
  return request<Health>("/healthz");
}
