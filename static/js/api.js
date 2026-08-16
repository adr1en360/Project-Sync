/*
  The one door to the service.

  Each path is relative, because the same FastAPI service sends this page and
  answers the API. So no module holds a host name.

  The API that the page drives:
    GET  /healthz
    POST /api/v1/trigger-sync        {repo_url, user_id, commit_sha?}
    GET  /api/v1/transactions/{id}
    POST /api/v1/regenerate-asset    {transaction_id}
    POST /api/v1/approval-callback   {transaction_id, approved, edited_assets?}
    GET  /api/v1/rules?user_id=
    POST /api/v1/rules               {user_id, text}
    POST /api/v1/rules/{id}          {state}
*/

/* An operator can point the page at a different host with ?api=… */
const API = new URLSearchParams(location.search).get("api") || "";

/**
 * Call the service and give the parsed body.
 * The function throws an Error that holds the message of the service, because
 * the operator must read the real reason and not a code.
 */
export async function api(path, options = {}) {
  const response = await fetch(API + path, {
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });

  let body = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }

  if (!response.ok) {
    const detail = body && body.detail ? body.detail : `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

export const postJson = (path, payload) =>
  api(path, { method: "POST", body: JSON.stringify(payload) });
