import { useEffect, useState } from "react";
import { getHealth, type Health } from "../api/client";

/**
 * One read of the state of the service.
 *
 * The shell asks one time, at the start. Two facts come from the answer, and
 * both are things a person can act on: a service that does not answer, and a
 * service that runs on a fixture and costs no model call.
 *
 * The model name and the configuration were here until 2026-08-22. They went,
 * because a person cannot act on either one.
 */

export type HealthState = {
  health: Health | null;
  error: string | null;
};

export function useHealth(): HealthState {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getHealth().then(
      (answer) => {
        if (live) {
          setHealth(answer);
        }
      },
      (reason: unknown) => {
        if (live) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return { health, error };
}