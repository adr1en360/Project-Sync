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
