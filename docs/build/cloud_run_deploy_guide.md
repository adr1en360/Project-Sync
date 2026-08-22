# Cloud Run deploy guide

The one place that holds the commands for the deploy. Stage F4b of the frontend
rebuild plan deploys the thin slice with `FIXTURE_MODE=1`, and stage F11 deploys
the full surface with the flag off.

**This file replaces the `gcloud services enable` list in
`docs/build/PROJECTSYNC_MASTER_BUILD_BLUEPRINT.md`, in
`docs/build/stack_and_timeline_engineering.md` and in
`docs/research/resource_roadmap.md`. Those three lists are wrong. Read the
Services section below for the reason.**

---

## The deploy is blocked, and not by code

Checked again on 2026-08-22:

```
gcloud billing projects describe project-sync-505710
  billingEnabled: false

gcloud billing accounts list
  ten accounts, every one of them OPEN: False
```

`run.googleapis.com`, `cloudbuild.googleapis.com` and
`artifactregistry.googleapis.com` are all absent from the enabled services of
the project, and a service cannot come on while payment is off. So the first
step is not a command in this file. **A person must attach an open billing
account to `project-sync-505710`.** Everything below then runs.

Firestore `(default)` is already live in `nam5`, and
`generativelanguage.googleapis.com` is already on.

---

## Step 1. Services

Four services, and only four:

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

Two of those four are the services the architecture names: Cloud Run and
Firestore. The other two are the machinery that `--source` needs, because
`--source` makes the image with Cloud Build and keeps it in Artifact Registry.

The lists in the three build documents name `aiplatform.googleapis.com` and
`secretmanager.googleapis.com`, and they miss Cloud Build and Artifact
Registry. Both of the names they add are wrong for this project: the hard rule
in `docs/AGENT.md` is two services, the model comes through
`generativelanguage.googleapis.com` which is already on, and no secret goes
through Secret Manager. Both of the names they miss stop the deploy.

## Step 2. Deploy

```bash
gcloud run deploy projectsync \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --no-cpu-throttling \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars FIXTURE_MODE=1,GOOGLE_CLOUD_PROJECT=project-sync-505710,GOOGLE_CLOUD_LOCATION=global
```

Each part that is not obvious:

- `--no-cpu-throttling` keeps the CPU on after the answer goes out. A Phase 1
  run is a `BackgroundTasks` task, so it runs **after** the response of
  `POST /trigger-sync`. With the default setting Cloud Run takes the CPU away at
  that moment and the run stops part way, which shows on the screen as a run
  that never leaves the first node.
- `--region us-central1` sits inside the `nam5` multi-region that holds
  Firestore, so a read does not cross the country.
- `FIXTURE_MODE=1` makes the run walk the seven nodes and write the same event
  log with no call to the model. The free tier is 20 requests a day, so the
  smoke test must not spend one. The masthead shows a "No model calls" badge
  while the flag is on, which reads `fixture_mode` from `GET /healthz`.
- `--memory 1Gi`, because the default 512Mi is close to the memory that the ADK
  import needs.
- `GITHUB_TOKEN` is absent on purpose. The fixture path reads no repository. Add
  it in stage F11 with the flag off.

## Step 3. Prove it

```bash
URL=$(gcloud run services describe projectsync --region us-central1 --format='value(status.url)')
curl -s "$URL/healthz"
```

The answer must hold `"fixture_mode": true`. Then open `$URL` in a browser and
walk it: submit a repository on Intake, watch the seven nodes advance on Run,
press Stop the run and see `CANCELLED`, press Run it again and see it re-run
under the same transaction id.

---

## Firestore needs no composite index

The earlier plan asked for composite indexes at this stage. It does not need
them. `store.py` sorts every list in Python and says why in its own docstrings:
`order_by` in Firestore removes a document that does not hold the field, so an
ordered query would hide rows.

What is left after that choice needs no index:

- Every filter is an equality filter. `user_id` with `state`, `user_id` with
  `status`, `user_id` with `project`, `user_id` with `tx_id` with `platform`.
  Firestore answers a set of equality filters from the single-field indexes that
  it makes by itself.
- One query orders: `run_events` at `store.py:277` orders the `events`
  subcollection by `started_at` and holds no filter. A single-field index
  answers that, and Firestore makes single-field indexes by itself, in a
  subcollection as well.

So there is nothing to create, and no query can fail at run time with "the query
requires an index".

---

## What was checked before the first deploy

The point of stage F4b is to spend the surprises of a first
`gcloud run deploy --source` early. These were checked on 2026-08-22 with no
billing account, because none of them needs one:

| Check | Result |
|---|---|
| `uv lock --check` | The lock file is current, so `uv sync --locked` in the image cannot fail on a stale lock. |
| `requires-python` against the image | `>=3.12,<3.13` against `python:3.12-slim`. They agree. |
| `web/package-lock.json` | Unchanged through stage F4, so `npm ci` cannot fail on a stale lock. |
| `.gcloudignore` | Was absent. This folder is not a Git repository, so `gcloud` would have uploaded `.venv/` and `web/node_modules/`. Written now. |
| Composite indexes | None needed. See above. |
| Docker locally | The daemon is not running, so the image was not built on this machine. This is the one check that stays open until the first real deploy. |
