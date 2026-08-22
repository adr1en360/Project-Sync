import { useCallback, useEffect, useRef, useState } from "react";
import { createRule, deleteRule, listRules, setRuleState } from "../api/client";
import type { StyleRule } from "../api/types";

/**
 * The rules of the voice of one person.
 *
 * The list is read one time, and it is read again after every change, because
 * the service holds the state of a rule and the client must not guess it. The
 * rules are read new on every generation, so a change here takes effect on the
 * next run and nothing on the screen has to move at the moment of the press.
 *
 * `busy` holds the id of the rule that is in flight, or `new` for a rule that is
 * being written. So one row waits while the others stay live.
 */

/** The mark of a rule that does not exist yet. No rule id can be this text. */
const NEW = "new";

export type RulesState = {
  rules: StyleRule[];
  loading: boolean;
  error: string | null;
  /** The id of the rule that is in flight, or `new`, or null. */
  busy: string | null;
  /** Turn one rule on, or off if it is on. */
  toggle: (rule: StyleRule) => void;
  /** Take one rule off the list. */
  remove: (rule: StyleRule) => void;
  /** Write one rule. True when the service accepted it. */
  add: (text: string) => Promise<boolean>;
};

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function useRules(userId = "default"): RulesState {
  const [rules, setRules] = useState<StyleRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // A change writes the state in the service, so the list comes again from the
  // service. The reference always holds the reader of the person on the screen.
  const again = useRef<() => void>(() => {});

  useEffect(() => {
    let live = true;

    const pull = async (): Promise<void> => {
      try {
        const list = await listRules(userId);
        if (live) {
          setRules(list);
          setError(null);
        }
      } catch (reason) {
        if (live) {
          // An empty list and a sentence, and not a screen that waits for ever.
          setRules([]);
          setError(messageOf(reason));
        }
      }
    };

    again.current = () => void pull();
    void pull();

    return () => {
      live = false;
    };
  }, [userId]);

  const act = useCallback((mark: string, call: () => Promise<unknown>) => {
    setBusy(mark);
    return call().then(
      () => {
        setBusy(null);
        setError(null);
        again.current();
        return true;
      },
      (reason: unknown) => {
        setBusy(null);
        setError(messageOf(reason));
        return false;
      },
    );
  }, []);

  const toggle = useCallback(
    (rule: StyleRule) => {
      void act(rule.rule_id, () =>
        setRuleState(rule.rule_id, rule.state === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
      );
    },
    [act],
  );

  const remove = useCallback(
    (rule: StyleRule) => {
      void act(rule.rule_id, () => deleteRule(rule.rule_id));
    },
    [act],
  );

  const add = useCallback(
    (text: string) => act(NEW, () => createRule(text, userId)),
    [act, userId],
  );

  return {
    rules: rules ?? [],
    loading: rules === null,
    error,
    busy,
    toggle,
    remove,
    add,
  };
}
