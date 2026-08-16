# Resource Roadmap

> **Track**: Taskmaster · **Window**: Aug 16 → **Aug 31, 2026, 5:00 PM PT** (15 days)
> **Source of truth**: [projectsync_full_spec.md](../../projectsync_full_spec.md) · **Claims**: [VERIFICATION_LEDGER.md](../VERIFICATION_LEDGER.md)
> Rewritten 2026-08-16. The 2026-08-11 version pointed at a retired documentation host,
> described ADK 1.x APIs, and listed four webinars that **could not be verified to exist**.
> See §4.

---

## How to use this file

There are 15 days. You cannot read everything. This is ordered by *when you will need it*,
and everything in Part 1 has been fetched and confirmed to exist at the URL given.

Read the **bold** items. Skim the rest when you hit the problem they solve.

---

## Part 1 — What to read, in order

### Day 1, before writing any code

| # | Resource | URL | Why now |
|---|---|---|---|
| **1** | **ADK graph workflows** | `https://adk.dev/graphs/index.md` | The engine. `Workflow(name=, edges=[...])` and the `"START"` entry node |
| **2** | **ADK data handling** | `https://adk.dev/graphs/data-handling/index.md` | **The most load-bearing page in the whole set.** How data moves between nodes |
| 3 | Full URL index | `https://adk.dev/llms.txt` | Machine-readable index of every page. Use this instead of guessing paths |

> ⚠️ **Every `google.github.io/adk-docs/*` URL is dead** — 301 to `adk.dev` `[L1.27]`. The
> 2026-08-11 version of this file used the retired host throughout.
>
> ⚠️ **The offline `/adk-cheatsheet` skill files are a pre-2.0 mirror with zero `/graphs/*`
> entries** `[L1.26]`. Do not use them for graph APIs. They will teach you ADK 1.x.

**What page 2 actually tells you** — the three facts that decide whether your graph works:

1. **A code node binds a typed parameter.** ADK inspects the signature and passes the
   predecessor's output as that argument.
2. **An agent node does not.** It receives the predecessor's `Event.output` as *user
   content* `[L1.21]`. Different mental model, same edge syntax.
3. **One `Event.output` per node execution** `[L1.23]`. Yield output once.

Number 2 is the one that broke this project's plan. See FM-02 in
[strategic_risk_and_win_analysis.md](strategic_risk_and_win_analysis.md).

**Instruction templating** — a graph agent node needs **no template**. Its input model
arrives as JSON user content and the wrapper forces `include_contents='none'`. A bare
`{key}` resolves from session state; a dotted `{Model.field}` resolves **never**, because
the dot fails `_is_valid_state_name` and the token comes back unchanged. Nothing raises
`[L1.28]`.

**Action, Day 1, first hour:**

```bash
uv add google-adk google-genai
uv run python -c "import google.adk; print(google.adk.__version__)"   # Expect 2.7.0
```

Then confirm the real import paths for `Workflow`, `Agent`, `Event`, and `RequestInput`
against the installed package. The docs are ambiguous about `Agent`'s module and this is
unresolved in the ledger `[L1.7]`. Ten minutes now saves an afternoon on Day 3.

### Day 1–2, while building the scanner and the agents

| # | Resource | URL | For |
|---|---|---|---|
| **4** | **Structured output** | `https://ai.google.dev/gemini-api/docs/structured-output` | Pydantic `output_schema` on the extraction and evaluation agents |
| 5 | Gemini API docs | `https://ai.google.dev/gemini-api/docs` | Model config, `GenerateContentConfig`, token limits |
| 6 | ADK Python SDK | `https://github.com/google/adk-python` | When the docs are ambiguous, read the source |
| 7 | Runnable samples | `https://github.com/google/adk-samples` | Working graphs to compare yours against |
| 8 | PyPI — **2.7.0** | `https://pypi.org/project/google-adk/` | Version pin |

> ⚠️ **`output_schema` disables tool calling** on that agent. A node cannot have both. This
> is already designed around: the GitHub scanner is a *code* node, so the extraction agent
> never needs a tool.

**The model pin.** `gemini-3.7-flash`. Not `gemini-3-flash-preview`, which is **below the
mandated 3.5 floor** and would fail the pass/fail Stage One check `[L2.3, L3.6]`. Pin it in
`config.py` and assert it at startup.

### Day 3–4, before the first deploy

| # | Resource | URL | For |
|---|---|---|---|
| **9** | **ADK on Cloud Run** | `https://adk.dev/deploy/cloud-run/index.md` | The deploy path that is actually supported |
| 10 | Cloud Run docs | `https://cloud.google.com/run/docs` | Timeouts, concurrency, scale-to-zero |
| 11 | Firestore Python client | `https://cloud.google.com/python/docs/reference/firestore/latest` | `FieldFilter`, `order_by` |

Enable exactly what is used. Four APIs, not seven:

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com
```

No `pubsub.googleapis.com`. No `gmail.googleapis.com`. Both were cut.

```bash
gcloud run deploy projectsync --source . --region us-central1
```

**Deploy a trivial container in week one, before the agent works.** The point is to find the
IAM and billing problems while they are still cheap.

Two Firestore gotchas that will cost an hour each if you meet them at 1 a.m.:

- `order_by` on a field **filters out documents where that field is absent.** A query that
  sorts by `completed_at` silently hides every pending row.
- If a query has an inequality filter, **that field must be ordered first.**

### Day 8+, Phase 2 and resilience

| # | Resource | URL | For |
|---|---|---|---|
| 12 | GitHub Contents API | `https://docs.github.com/en/rest/repos/contents` | `get_contents` → `update_file` / `create_file` upsert |
| 13 | PyGithub | `https://pygithub.readthedocs.io/` | The commit path for both repositories |
| 14 | Cloud Logging Python | `https://cloud.google.com/logging/docs/reference/libraries` | Structured logs — these become demo proof |

**The upsert pattern**, because "create a file that already exists" is a 422 and it will
happen on the second run of the demo:

```python
def upsert_file(repo, path: str, content: str, message: str) -> str:
    """Write a file to a repository. Make it or change it.

    GitHub has two different calls. Use update_file if the file is present.
    Use create_file if the file is not present. A create call on a file that is
    present gives an error.
    """
    try:
        existing = repo.get_contents(path)
        result = repo.update_file(path, message, content, existing.sha)
    except GithubException as error:
        if error.status != 404:
            raise
        result = repo.create_file(path, message, content)
    return result["commit"].sha
```

### Day 13+, submission

| # | Resource | URL | For |
|---|---|---|---|
| **15** | **Rules & criteria** | `https://allthingsagentichackathon.devpost.com/rules` | Re-read on **Aug 29**, against frozen code |
| 16 | Resources & credits | `https://allthingsagentichackathon.devpost.com/resources` | Credit request, official links |
| 17 | Hackathon home | `https://allthingsagentichackathon.devpost.com/` | Submission form |

---

## Part 2 — GCP credits: what is actually known

The 2026-08-11 version of this file built a Day-1 action item and a Week-2 dependency around
a "$150 GCP credit, 72-business-hour approval, Aug 28 12:00 PM PT deadline." **None of those
three figures has a confirmed source** `[L3.14]`.

| Claim | Status |
|---|---|
| $24,500 GCP credit pool across the whole event | ✅ verified |
| **$150 per participant** | ⬜ **no source found** |
| **Request deadline Aug 28, 12:00 PM PT** | ⬜ **no source found** |
| **Up to 72 business hours to approve** | ⬜ **no source found** |

**What to do about it.** Request credits on Day 1 anyway — asking costs nothing, and an
unverified figure cuts both ways. Then **remove the dependency**: build locally against a
Gemini API key and the Firestore emulator, so approval timing cannot block the build.

```bash
GOOGLE_GENAI_USE_VERTEXAI=False            # Switch to true after GCP access is confirmed.
GOOGLE_API_KEY=...             # Direct API key. Used for local development.
FIRESTORE_EMULATOR_HOST=localhost:8080
GITHUB_TOKEN=...
```

Set a billing budget alert before the first Vertex AI call, not after.

---

## Part 3 — The judging structure

The earlier version described "100 Points Total" with a 40/30/30 split. There is no
100-point scale, and the split is one of three stages.

| Stage | Mechanic |
|---|---|
| **One** | **Pass/fail completeness check. Nothing is scored until it passes** `[L3.6]` |
| **Two** | **1–5 per criterion**, weighted 40 / 30 / 30 |
| **Three** | Bonuses. Max final score **6** `[L3.7]` |

Stage Two, and the phrase in it that changes what you build:

| Criterion | Weight | The clause that matters |
|---|---|---|
| Innovation & Operational Utility | 40% | *"high-value, autonomous execution over simple chat queries"* |
| Architectural Discipline & Tech Stack | 30% | *"decouple systems, manage state,"* and **"design failure-tolerant agents"** `[L3.8]` |
| Demo & Production Readiness | 30% | *"undeniable proof of execution in the video pitch"* `[L3.5]` |

**"Design failure-tolerant agents" is in the official criteria.** That is why the spec §9
fallback matrix is scored work and not polish.

Stage Three — **+0.4 for about two hours**, and it was missing from every earlier doc:

| Bonus | Value | Planned |
|---|---|---|
| Published build write-up | +0.2 | ✅ material already exists in this tree |
| Post tagged `#AllThingsAgenticHackathon` | +0.2 | ✅ ~15 minutes |
| Each extra Google AI model (Gemma, Veo, Lyria) | +0.2 each, cap +0.6 | ❌ scope creep |

---

## Part 4 — On the "GEAR webinars"

The 2026-08-11 version of this file listed four **GEAR (Google Engineers & Agent
Researchers)** webinars with exact titles, runtimes (45 / 50 / 40 / 35 minutes), and
day-by-day viewing schedules.

**No source was found for any of them.** Not the sessions, not the runtimes, not the
acronym. They have the shape of invented content: precise, plausible, and unlinkable. Two of
the four also taught the cut architecture — Pub/Sub push subscriptions and Gmail approval
gates — so following them would have actively misdirected the build.

They are removed rather than corrected. If the Devpost Resources tab lists real sessions,
add them here with URLs.

**What replaces them.** The Part 1 list, in order, and the copy-paste code in
[adk_api_cheatsheet_notes.md](adk_api_cheatsheet_notes.md) — which is more useful than a
webinar because it is already checked against the real 2.0 API surface, with a ledger
reference on every non-obvious line.

---

## Part 5 — Component → resource map

Current architecture. Six graph nodes, three of them Python.

| Component | Stack | Read this |
|---|---|---|
| `graph.py` — `Workflow` factory | ADK 2.0 | **#1, #2** |
| `nodes/scanner.py` — code node | GitHub API, httpx | #12 |
| `nodes/extraction.py` — agent node | Gemini + `output_schema` | **#4**, #5 |
| `nodes/style_rules.py` — code node | Firestore read | #11 |
| `nodes/generator.py` — agent node | Gemini, `{AssetGenInput.style_rules}` | **#2**, #4 |
| `nodes/evaluator.py` — agent node | Gemini at `temperature=0.0` | #4 |
| `nodes/persist.py` — code node | Firestore write | #11 |
| `main.py` — FastAPI, 5 endpoints | Cloud Run | **#9**, #10 |
| `sync/github.py` — both commits | PyGithub | #12, #13 |
| `Dockerfile` | Cloud Run | **#9** |
| Demo + submission | Devpost | **#15**, #16 |

There is no `gmail_approval.py` and no Pub/Sub script. Approval is
`POST /api/v1/approval-callback` from the dashboard.

---

## Reading budget

| Phase | Read | Hours |
|---|---|---|
| Day 1 | #1, #2, #3, #4 | ~2 |
| Day 3–4 | #9, #11 | ~1 |
| Day 8+ | #12, #13 | ~1 |
| Day 13+ | #15 | ~0.5 |

**About 4.5 hours of reading across 15 days.** Everything else is reference — open it when
you hit the problem it solves, not before.

_Last updated: 2026-08-16_
