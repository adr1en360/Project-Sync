/*
  The values that more than one module reads.

  Each module imports this same object, so a write in one module is visible in
  each other module. Change the fields of the object. Do not replace the object,
  because a new object breaks that link.

  This file also holds the two names in `localStorage`. The names are here and
  not in the three modules that use them, so a spelling mistake is not possible.
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
