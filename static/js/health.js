/*
  The three values in the masthead, and the strip that reports a configuration
  that is not complete.
*/

import { api } from "./api.js";
import { el } from "./dom.js";
import { slip } from "./slips.js";

/** Read `/healthz` and put the model, the route, and the state in the masthead. */
export async function loadHealth() {
  try {
    const health = await api("/healthz");
    el.health.model.textContent = health.model;
    el.colophonModel.textContent = health.model;
    el.health.route.textContent = health.use_vertex_ai ? "Vertex AI" : "Gemini API";
    el.health.status.textContent = "up";
    el.health.status.dataset.ok = "yes";

    const missing = health.missing_config || [];
    if (missing.length) {
      el.configStrip.hidden = false;
      el.configStrip.textContent =
        `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set. ` +
        "Phase 1 still runs. The commits on approval need these values.";
    }
  } catch (error) {
    el.health.status.textContent = "unreachable";
    el.health.status.dataset.ok = "no";
    slip("Service", `The health check failed. ${error.message}`, "bad");
  }
}
