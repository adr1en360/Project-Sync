/**
 * The shape of the data that the service sends.
 *
 * Each type here mirrors a model in `models.py`. A state that the service can
 * send must have a name here, because `labels.ts` holds a record over these
 * names and the compiler then refuses a state that has no sentence.
 *
 * Each group of states is a value and not only a type. A test reads the value to
 * prove that every state has copy, and a type alone cannot be read at run time.
 */

export const TRANSACTION_STATUSES = [
  "RUNNING",
  "PENDING_APPROVAL",
  "PARTIAL",
  "COMPLETED",
  "REJECTED",
  "FAILED_SCAN",
  "FAILED_EXTRACTION",
  "FAILED_GENERATION",
  "CANCELLED",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/**
 * The one state in which the service accepts a cancel.
 *
 * `routes/transactions.py` answers 409 for every other state. The interface
 * offers the control only in this state, because a control that cannot work must
 * not be on the screen.
 */
export const CANCELLABLE_STATUS = "RUNNING";

/**
 * The states from which the service accepts a resume.
 *
 * The list is the same as `_RESUMABLE` in `routes/transactions.py`. Keep the two
 * the same. A resume is a new run of Phase 1 under the same transaction id, and
 * not a start from the middle of the graph.
 */
/**
 * The one state in which the review desk offers a decision.
 *
 * `routes/phase2.py` holds no gate on the status of the row, so it accepts a
 * second approval of a run that is already committed, and it would write the two
 * commits twice. The client holds that gate for it, the same way it holds the
 * gate on cancel: the two controls of a decision are on the screen in this state
 * only.
 */
export const DECIDABLE_STATUS = "PENDING_APPROVAL";

/**
 * The state in which one commit landed and the other did not.
 *
 * A retry is the same call as an approval, because the two commits are
 * independent. The one that landed is written again with the same content, and
 * the one that failed gets another try.
 */
export const RETRYABLE_STATUS = "PARTIAL";

export const RESUMABLE_STATUSES: readonly TransactionStatus[] = [
  "CANCELLED",
  "FAILED_SCAN",
  "FAILED_EXTRACTION",
  "FAILED_GENERATION",
];

export const RUN_EVENT_STATES = ["STARTED", "COMPLETED", "FAILED", "CANCELLED"] as const;

export type RunEventState = (typeof RUN_EVENT_STATES)[number];

export const RULE_STATES = ["PROPOSED", "ACTIVE", "INACTIVE", "DELETED"] as const;

export type RuleState = (typeof RULE_STATES)[number];

export const PUBLISH_PATHS = ["FULL_PUBLISH", "PRIVATE_ONLY"] as const;

export type PublishPath = (typeof PUBLISH_PATHS)[number];

/**
 * One transition of one node.
 *
 * The log is append-only, and a resume adds a second set of events under the
 * same transaction id. So the run screen reads the last attempt and not the
 * whole log. See `lastAttempt` in `hooks/useTransaction.ts`.
 */
export type RunEvent = {
  event_id: string;
  tx_id: string;
  node: string;
  state: RunEventState;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

export type PortfolioCard = {
  title: string;
  tagline: string;
  stack: string[];
  highlights: string[];
  repo_url: string;
};

export type GeneratedAssets = {
  doc_sheet_md: string;
  portfolio_card: PortfolioCard;
  resume_bullets: string[];
  social_draft: string;
};

/**
 * The facts that the extraction agent found.
 *
 * The review desk is the first screen that reads them. The run screen reads
 * none of them, because a run shows how far it went and not what it found.
 */
export type ExtractedMetadata = {
  project_name: string;
  tagline: string;
  problem_solved: string;
  tech_stack: string[];
  key_features: string[];
  architecture_summary: string;
  has_readme: boolean;
  has_tests: boolean;
  has_license: boolean;
  completeness_notes: string[];
};

/**
 * The verdict of the evaluator.
 *
 * `recommendation` is the verdict and the two lists say why. `confidence` is a
 * number from 0 to 1. The verdict does not stop an approval, because the person
 * is the gate and the model is the advice.
 */
export type PathRecommendation = {
  recommendation: PublishPath;
  reasons: string[];
  missing_elements: string[];
  confidence: number;
};

export type RuleSource = "USER" | "CURATOR";

/**
 * One rule of the voice of a person.
 *
 * A rule that a person writes arrives PROPOSED, the same as a rule that the
 * curator found, so no rule changes a draft until the person turns it on.
 */
export type StyleRule = {
  rule_id: string;
  text: string;
  state: RuleState;
  source: RuleSource;
  source_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetSource = "GENERATED" | "REGENERATED" | "HUMAN_EDITED";

export type AssetVersion = {
  assets: GeneratedAssets;
  source: AssetSource;
  created_at: string;
  style_rules_applied: string[];
};

export type Transaction = {
  tx_id: string;
  user_id: string;
  repo_url: string;
  repo_name: string;
  status: TransactionStatus;
  metadata: ExtractedMetadata | null;
  asset_versions: AssetVersion[];
  recommendation: PathRecommendation | null;
  style_rules_applied: string[];
  approval_token: string | null;
  doc_commit_sha: string | null;
  card_commit_sha: string | null;
  error_message: string | null;
  created_at: string | null;
  completed_at: string | null;
  /** The assets of the newest version. The service computes this field. */
  assets: GeneratedAssets | null;
};

/**
 * The answer of `POST /approval-callback`.
 *
 * The two commits are independent, so the answer can hold one sha and one error.
 * A rejection answers with the status alone, so every other field can be absent.
 */
export type ApprovalResult = {
  status: TransactionStatus;
  doc_commit_sha?: string | null;
  card_commit_sha?: string | null;
  doc_error?: string | null;
  card_error?: string | null;
  /** The rules that the curator found after this approval. Each one is a text. */
  proposed_rules?: string[];
};

/** The answer of `POST /rules/{id}` and of `DELETE /rules/{id}`. */
export type RuleStateChange = {
  rule_id: string;
  state: RuleState;
};

/** The answer of `POST /trigger-sync`, and of `POST /transactions/{id}/resume`. */
export type SyncStarted = {
  transaction_id: string;
  status: TransactionStatus;
};