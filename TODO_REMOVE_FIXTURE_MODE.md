# TODO: Remove FIXTURE_MODE after demo

**Added during Stage 1** — `FIXTURE_MODE` in `config.py` and the fixture file in `tests/fixtures/` are temporary scaffolding for UI development without burning the 20 daily Gemini free-tier calls.

**Remove after:**
- Demo recording is complete (Aug 29)
- Before final submission (Aug 31)

**Files to remove:**
1. `config.py` — the `FIXTURE_MODE` constant and its docstring
2. `tests/fixtures/` — entire directory with canned transaction
3. `adk_runtime.py` — the `if config.FIXTURE_MODE:` branch in `run_workflow`
4. Any tests that depend on `FIXTURE_MODE=1`

**Why it exists:** The learning loop test (Stage 2) and all UI work (Stages 5–8) need dozens of reloads. At 5 full runs/day, the free tier would be exhausted in one afternoon of iteration. Fixture mode keeps the 20 calls for real end-to-end runs and the demo recording.