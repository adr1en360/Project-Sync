/**
 * The copy contract.
 *
 * One file holds every sentence that names a state of the service. Each map is a
 * record over the type of its states, so the compiler fails the build if the
 * service gains a state and no one writes a sentence for it. The interface that
 * this one replaced had nine keys for statuses and no key for `CANCELLED`, which
 * a live endpoint writes, and nothing caught it.
 *
 * A machine name never reaches the screen by itself. `NODE` gives the sentence,
 * and the run screen shows the machine name under it only when a person turns
 * the "Show more" control on.
 */

import type { BulletTag, PublishPath, RuleState, TransactionStatus } from "./api/types";
import type { TagTone } from "./ui/Tag";

/**
 * The seven nodes of the Phase 1 graph, in the order that they run.
 *
 * The order is the order in `graph.py` and in `adk_runtime.GRAPH_NODES`. Keep
 * the three the same.
 */
export const NODE_ORDER = [
  "scan_github_repository",
  "extraction_agent",
  "attach_style_rules",
  "asset_generator_agent",
  "select_evaluator_input",
  "path_evaluator_agent",
  "persist_transaction",
] as const;

export type NodeName = (typeof NODE_ORDER)[number];

export const NODE: Record<NodeName, string> = {
  scan_github_repository: "Read the repository",
  extraction_agent: "Understand the project",
  attach_style_rules: "Attach your voice rules",
  asset_generator_agent: "Write the four drafts",
  select_evaluator_input: "Choose what to check",
  path_evaluator_agent: "Check it is safe to show",
  persist_transaction: "Save it and stop for you",
};

export const STATUS: Record<TransactionStatus, string> = {
  RUNNING: "Running",
  PENDING_APPROVAL: "Waiting for you",
  PARTIAL: "Partly committed",
  COMPLETED: "Committed",
  REJECTED: "Discarded by you",
  FAILED_SCAN: "Could not read the repository",
  FAILED_EXTRACTION: "Could not read the project",
  FAILED_GENERATION: "Could not write the drafts",
  CANCELLED: "Stopped by you",
};

/**
 * The tone of the tag for each status.
 *
 * The tone is the third channel of a state, after the mark and the word, so no
 * meaning depends on it. A state that a person must act on takes `hold`.
 */
export const STATUS_TONE: Record<TransactionStatus, TagTone> = {
  RUNNING: "accent",
  PENDING_APPROVAL: "hold",
  PARTIAL: "hold",
  COMPLETED: "pass",
  REJECTED: "quiet",
  FAILED_SCAN: "fail",
  FAILED_EXTRACTION: "fail",
  FAILED_GENERATION: "fail",
  CANCELLED: "quiet",
};

/**
 * The verdict of the safety check, in words.
 *
 * The verdict is advice and it is not a gate, so neither sentence says that the
 * service refused anything. The person decides, and both verdicts leave the two
 * controls of a decision on the screen.
 */
export const PUBLISH_PATH: Record<PublishPath, string> = {
  FULL_PUBLISH: "Safe to show in public",
  PRIVATE_ONLY: "Keep this one private",
};

/** What each verdict asks a person to do, in one more sentence. */
export const PUBLISH_PATH_NOTE: Record<PublishPath, string> = {
  FULL_PUBLISH:
    "The check found nothing in the drafts that a public repository should hide.",
  PRIVATE_ONLY:
    "The check found something to fix first. You can still approve it.",
};

/**
 * The tone of each verdict.
 *
 * The tone is the third channel, after the mark and the word, so no meaning
 * depends on it.
 */
export const PUBLISH_PATH_TONE: Record<PublishPath, "pass" | "hold"> = {
  FULL_PUBLISH: "pass",
  PRIVATE_ONLY: "hold",
};

export const RULE_STATE: Record<RuleState, string> = {
  PROPOSED: "Suggested",
  ACTIVE: "On",
  INACTIVE: "Off",
  DELETED: "Removed",
};

/** The name of the graph. It shows under the "Show more" control. */
export const GRAPH_NAME = "projectsync_phase1";

/**
 * The name of each tag of a bullet, in words a person uses.
 *
 * The service holds the tags in capitals with a low line between the words, and
 * that form must not reach the screen. The record is over the type, so a new tag
 * in `models.py` fails the build until somebody writes its name here.
 */
export const BULLET_TAG: Record<BulletTag, string> = {
  IMPACT: "Impact",
  LEADERSHIP: "Leadership",
  TECHNICAL: "Technical",
  COLLABORATION: "Teamwork",
  PROBLEM_SOLVING: "Problem solving",
  ARCHITECTURE: "Architecture",
  PERFORMANCE: "Performance",
  SECURITY: "Security",
  TESTING: "Testing",
  DEVOPS: "Operations",
  FRONTEND: "Front end",
  BACKEND: "Back end",
  DATA: "Data",
  MOBILE: "Mobile",
  CLOUD: "Cloud",
};
