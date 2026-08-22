import { useEffect, useState } from "react";
import { getHealth, type Health } from "./api/client";

/**
 * The shell for stage F1.
 *
 * This page proves three things. Vite makes a build. FastAPI sends that build at
 * the root path. A call to the API on the same origin works.
 *
 * The page has almost no style, and that is on purpose. The design tokens come
 * in stage F2, and the real shell and layout come in stage F3.
 */
export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The flag stops a write to state after the component goes away. React runs
    // this effect two times in development, so the guard is necessary.
    let live = true;
    getHealth()
      .then((next) => {
        if (live) setHealth(next);
      })
      .catch((cause: Error) => {
        if (live) setError(cause.message);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <main style={{ maxWidth: "42rem", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <h1>ProjectSync</h1>
      <p>
        The React interface is built by Vite and sent by FastAPI. This is stage F1
        of the rebuild.
      </p>

      {error !== null && (
        <p role="alert">The service did not answer: {error}</p>
      )}

      {health !== null && (
        <dl>
          <dt>Status</dt>
          <dd>{health.status}</dd>
          <dt>Model</dt>
          <dd>
            <code>{health.model}</code>
          </dd>
          <dt>Vertex AI</dt>
          <dd>{health.use_vertex_ai ? "yes" : "no"}</dd>
          <dt>Absent settings</dt>
          <dd>
            {health.missing_config.length > 0
              ? health.missing_config.join(", ")
              : "none"}
          </dd>
        </dl>
      )}
    </main>
  );
}
