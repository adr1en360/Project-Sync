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

import type {
  ApprovalResult,
  GeneratedAssets,
  RuleState,
  RuleStateChange,
  RunEvent,
  StyleRule,
  SyncStarted,
  Transaction,
} from "./types";

/** Every route of the API carries this prefix. `/healthz` does not. */
const API = "/api/v1";

export type Health = {
  status: string;
  model: string;
  use_vertex_ai: boolean;
  /**
   * True when the service answers from a fixture and makes no model call.
   *
   * The masthead shows a badge for this. The free tier gives 20 requests a day,
   * so a person must be able to see that a run is free before they start it.
   */
  fixture_mode: boolean;
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

/**
 * Start Phase 1 on one repository.
 *
 * The answer arrives at once with the transaction id, and the graph runs behind
 * the request. The run screen then polls. A graph workflow does not stream, so a
 * poll is the correct pattern and not a shortcut.
 *
 * The service accepts every form that a person pastes, from `owner/name` to a
 * deep URL, so this function sends the text as it is and lets the service judge
 * it. A second opinion in the client would only disagree with the first.
 */
export function triggerSync(repoUrl: string, userId = "default"): Promise<SyncStarted> {
  return request<SyncStarted>(`${API}/trigger-sync`, {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl, user_id: userId }),
  });
}

/** Read one transaction row. */
export function getTransaction(txId: string): Promise<Transaction> {
  return request<Transaction>(`${API}/transactions/${encodeURIComponent(txId)}`);
}

/** Read the event log of one run, with one entry for each node transition. */
export function getRunEvents(txId: string): Promise<RunEvent[]> {
  return request<RunEvent[]>(`${API}/transactions/${encodeURIComponent(txId)}/events`);
}

/**
 * Ask the run to stop.
 *
 * The service answers 409 unless the row says RUNNING. The interface offers the
 * control only then, so this call does not fail in normal use.
 */
export function cancelRun(txId: string): Promise<{ status: string; transaction_id: string }> {
  return request<{ status: string; transaction_id: string }>(
    `${API}/transactions/${encodeURIComponent(txId)}/cancel`,
    { method: "POST" },
  );
}

/**
 * Run Phase 1 again for a run that stopped, under the same transaction id.
 *
 * The service answers 409 for a state that is not in `RESUMABLE_STATUSES`.
 */
export function resumeRun(txId: string): Promise<SyncStarted> {
  return request<SyncStarted>(`${API}/transactions/${encodeURIComponent(txId)}/resume`, {
    method: "POST",
  });
}

/**
 * Approve the drafts, and let Phase 2 write the two commits.
 *
 * Phase 2 is a different request from Phase 1 and it can come days later, so the
 * whole decision goes in this one call. `edited` carries the four drafts only
 * when a person changed one of them. Sending them when nothing changed would
 * write a version marked as a human edit for a draft that no human touched, and
 * the rule curator reads those marks to learn a voice.
 */
export function approveRun(
  txId: string,
  edited: GeneratedAssets | null = null,
): Promise<ApprovalResult> {
  return request<ApprovalResult>(`${API}/approval-callback`, {
    method: "POST",
    body: JSON.stringify({
      transaction_id: txId,
      approved: true,
      edited_assets: edited,
    }),
  });
}

/**
 * Discard the drafts. Nothing is written and nothing leaves the service.
 *
 * The row becomes REJECTED and it keeps the drafts, so the receipt of the run
 * stays readable after the decision.
 */
export function rejectRun(txId: string): Promise<ApprovalResult> {
  return request<ApprovalResult>(`${API}/approval-callback`, {
    method: "POST",
    body: JSON.stringify({
      transaction_id: txId,
      approved: false,
      edited_assets: null,
    }),
  });
}

/** Read the rules of one person. A rule that they deleted is not in the list. */
export function listRules(userId = "default"): Promise<StyleRule[]> {
  return request<StyleRule[]>(`${API}/rules?user_id=${encodeURIComponent(userId)}`);
}

/** Write one rule by hand. The new rule is PROPOSED, like every other rule. */
export function createRule(text: string, userId = "default"): Promise<StyleRule> {
  return request<StyleRule>(`${API}/rules`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, text }),
  });
}

/**
 * Turn one rule on or off.
 *
 * The rules are read new on every generation, so the change takes effect on the
 * next run. Nothing on the screen has to move at the moment of the press.
 */
export function setRuleState(ruleId: string, state: RuleState): Promise<RuleStateChange> {
  return request<RuleStateChange>(`${API}/rules/${encodeURIComponent(ruleId)}`, {
    method: "POST",
    body: JSON.stringify({ state }),
  });
}

/**
 * Take one rule off the list.
 *
 * This is not the toggle. The toggle turns a rule off and the list still shows
 * it. This hides the rule, and the document stays in the database, because a
 * past run holds the id of every rule that made it.
 */
export function deleteRule(ruleId: string): Promise<RuleStateChange> {
  return request<RuleStateChange>(`${API}/rules/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
  });
}