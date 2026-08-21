/*
  The values that more than one module reads.

  Each module imports this same object, so a write in one module is visible in
  each other module. Change the fields of the object. Do not replace the object,
  because a new object breaks that link.

  This file also holds each name in `localStorage`. The names are here and not in
  the modules that use them, so a spelling mistake is not possible.
*/

export const state = {
  tx: null, // the transaction row from the last poll
  rules: [], // the voice rules of this operator
  polls: 0, // the count of polls for the record that is open
  timer: null, // the handle of the next poll
  stamped: "", // the verdict that the stamp shows now
};

/** The operator name. A reload puts it back in the intake form. */
export const SAVED_USER = "ps.user";

/** The record that is open. A reload opens the same record again. */
export const SAVED_TX = "ps.tx";

/**
 * The theme that the operator chose: "light" or "dark".
 * No value means that the operator made no choice. The page then follows the
 * theme of the operating system.
 */
export const SAVED_THEME = "ps.theme";

/** The tab that is open. A reload shows the same tab again. */
export const SAVED_TAB = "ps.tab";

/**
 * The width of the sideboard: "open" or "collapsed".
 * The choice holds across a reload, because a person who makes the rail narrow
 * wants a wide column of work at the next visit as well.
 */
export const SAVED_RAIL = "ps.rail";

/** The part of the library that is open: bullets, showcase or history. */
export const SAVED_LIB = "ps.lib";
