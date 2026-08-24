/**
 * The numbers and the times that a person reads.
 *
 * A format lives here and not in the screen that shows it, because the run screen
 * and the history show the time of the same node and the two must agree.
 */

/** The name of each month, short. */
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Show a time that a person can read. Under a second still reads as a time. */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Two digits, for an hour and for a minute. */
function pad(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

/**
 * Show the day and the time of a moment that the service sent.
 *
 * The service writes the time in UTC. `Date` gives the parts in the time of the
 * machine, which is the time that a person keeps, so the day is their day.
 *
 * The month comes from the list above and not from the locale of the browser. A
 * locale gives a different string on a different machine, and a test cannot then
 * read the same answer twice.
 */
export function when(iso: string | null): string {
  if (iso === null || iso === "") {
    return "";
  }
  const moment = new Date(iso);
  const day = moment.getDate();
  const month = MONTH[moment.getMonth()];
  if (Number.isNaN(day) || month === undefined) {
    // A string that is not a date is shown as it arrived. A wrong date is worse
    // than a raw string, because a person cannot see that it is wrong.
    return iso;
  }
  return `${String(day)} ${month} ${String(moment.getFullYear())}, ${pad(moment.getHours())}:${pad(moment.getMinutes())}`;
}

/**
 * Show only the day of a moment.
 *
 * A list of bullets carries one date for each row, and the hour that a bullet was
 * written tells a person nothing that they use. The year is given only when it is
 * not the year now, so a bank of this year holds no repeated number.
 */
export function day(iso: string | null): string {
  if (iso === null || iso === "") {
    return "";
  }
  const moment = new Date(iso);
  const date = moment.getDate();
  const month = MONTH[moment.getMonth()];
  if (Number.isNaN(date) || month === undefined) {
    return iso;
  }
  const year = moment.getFullYear();
  return year === new Date().getFullYear()
    ? `${String(date)} ${month}`
    : `${String(date)} ${month} ${String(year)}`;
}

/**
 * Format a raw error string or object into a human-readable headline and optional detail.
 */
export function humanizeError(raw: string): { message: string; technical?: string } {
  const text = raw.trim();

  // Pattern: "GitHub gave <status> for <path>: {JSON}"
  const ghMatch = text.match(/^GitHub gave (\d+) for ([^:]+):\s*(\{.*?\})$/s);
  if (ghMatch) {
    const status = ghMatch[1];
    const path = ghMatch[2].trim();
    const jsonStr = ghMatch[3];
    try {
      const parsed = JSON.parse(jsonStr);
      const apiMsg = parsed.message ?? "Not Found";
      if (status === "404") {
        return {
          message: `GitHub repository not found (${status})`,
          technical: `Could not access ${path}. Check that the repository exists and your GITHUB_TOKEN has access if it is private.`,
        };
      }
      if (status === "401") {
        return {
          message: `GitHub authentication failed (401: ${apiMsg})`,
          technical: "Your GITHUB_TOKEN appears to be invalid or expired. Check your .env settings.",
        };
      }
      if (status === "403") {
        return {
          message: `GitHub permission denied (403: ${apiMsg})`,
          technical: `Access to ${path} was blocked. Check your rate limits or GITHUB_TOKEN scopes.`,
        };
      }
      return {
        message: `GitHub API error (${status}: ${apiMsg})`,
        technical: `Path: ${path}`,
      };
    } catch {
      // Fallback
    }
  }

  // Check if string contains JSON blob at the end
  const jsonEndMatch = text.match(/^(.*?):\s*(\{.*?\})$/s);
  if (jsonEndMatch) {
    const prefix = jsonEndMatch[1].trim();
    const jsonStr = jsonEndMatch[2];
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.message) {
        return {
          message: `${prefix}: ${parsed.message}`,
          technical: jsonStr,
        };
      }
    } catch {
      // Fallback
    }
  }

  return { message: text };
}
