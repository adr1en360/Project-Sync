# ProjectSync — Devpost submission copy

## Inspiration

I build a lot of projects. Hackathon entries, side tools, things I start on a weekend
because I want to know if they work. Almost none of them ever get a portfolio entry, a
resume line, or a post.

The code is not the bottleneck. The bottleneck is that after a project is finished,
writing it up is a separate job with none of the fun in it. You have to re-read your own
repo, remember what was hard, decide what a stranger would care about, and then write the
same facts four different ways for four different audiences. It is tedious enough that it
gets skipped, and it gets skipped every time, so the work stays invisible.

ProjectSync is the thing I wanted for myself: paste a repo URL, get the four write-ups,
approve them once, done. The test repo is its own repository. I ran the tool on the
codebase that builds the tool.

## What it does

You paste a GitHub URL into the review desk and click one button.

ProjectSync reads the repository, then writes four things:

- a documentation sheet in Markdown
- a portfolio card as structured JSON
- a resume bullet draft
- a LinkedIn/X post draft

Then it does something less usual. A third agent scores whether the repo is actually
ready to be shown to a stranger and recommends `FULL_PUBLISH` or `PRIVATE_ONLY`.
"Complete" here does not mean the code runs. It means there is a real README, no secret
sitting in a file, no leftover TODO in a core file. A project can work perfectly and still
fail this check, which is exactly what happens to real hackathon repos built under time
pressure.

Nothing is published until you say so. The four drafts land on a review desk where you can
edit any of them, regenerate any single tab, and then Approve or Discard. On Approve it
commits the documentation sheet and the portfolio card to a private portfolio repository
and records both commit SHAs.

The part I care about most is the memory. Every edit you make is kept. After a couple of
approved projects, a curator agent reads the before-and-after pairs of your own edits and
proposes a style rule in your voice: "do not open a post with Excited to share", "name the
constraint, not the result". Proposed rules do nothing until you click once to activate
them. Active rules are read fresh from Firestore on every run, so toggling one changes the
next draft with no redeploy. You can also regenerate a pending review after flipping a
rule, so a rule you just learned applies to the project already on screen.

Rules have three states and all three are visible and toggleable: `PROPOSED`, `ACTIVE`,
`INACTIVE`. A dismissed proposal becomes `INACTIVE` rather than being deleted, so you can
turn it back on later.

## How we built it

Phase 1 is an ADK 2.0 graph `Workflow` with six nodes. Three are plain Python and three
are LLM agents:

```
START
  -> scan_github_repository   code    GitHub REST via httpx, no model call
  -> extraction_agent         agent   structured metadata, output_schema
  -> attach_style_rules       code    reads ACTIVE rules from Firestore
  -> asset_generator_agent    agent   all four assets in one pass
  -> path_evaluator_agent     agent   publish-readiness verdict
  -> persist_transaction      code    writes PENDING_APPROVAL to Firestore
```

The three-code-to-three-agent ratio is deliberate. Filtering a repository is exact work and
a model does it worse, so the scan is code: it drops ignored directories and binary
extensions, caps a single file at 100 KB and the whole payload at 400 KB, and keeps at most
40 files. That filter runs before the request, not after, because a large repo will
otherwise fill the entire context window with dependency code.

Phase 2 is not an agent run. It is plain FastAPI. ADK 2.0 does have a human-in-the-loop
node, but Cloud Run scales to zero between the trigger and the approval, so a paused run's
process is gone before the human comes back. The resume point is a row in Firestore and the
resume trigger is an HTTP request. That is a failure-tolerance decision, not a limitation
of the framework.

Two GCP services, which is one over the minimum: Cloud Run hosts the app, Firestore holds
both memories. The transaction rows *are* the episodic memory. The style rules are the
semantic memory. No Pub/Sub, because the only trigger is a person pasting a URL and there
is nothing to decouple.

The interface is plain HTML, CSS, and JavaScript with no build step: 16 numbered CSS files
and 18 JS modules, served out of `static/` by the same FastAPI app. One container holds the
API and the UI, so the deploy is one Cloud Run service and there is no Node in the image.
Phase 1 takes roughly 30 to 90 seconds, so the client polls a status endpoint rather than
holding a stream open.

The model is pinned to `gemini-3.5-flash` and asserted at import. If someone sets a model
below the mandated Gemini 3.5 floor, the application refuses to start.

## Challenges we ran into

The hardest problem was not code. It was that my own documentation was confidently wrong.

The first documentation pass was written before anyone checked the ADK 2.0 API line by
line. It read well and it was full of invented detail: a prize table that does not exist,
webinars that never happened, a 100-point scoring scale that is not how the judging works.
When I audited it, 22 of 36 files asserted at least one premise that had been cut or
corrected. I kept the whole thing as a frozen log instead of deleting it, because it
records how the errors got in.

Three specific traps came out of that audit:

**A wrong reason for a right decision.** I had written that ADK has no built-in agent type
for a human decision that arrives hours later. That is false. `RequestInput` exists.
Keeping Phase 2 outside the agent run is still correct, but for a completely different
reason, and a judge who knows the framework would have caught the false claim. An incorrect
statement about the framework costs more credibility than the design choice ever earned.

**A memory system that would have demoed perfectly and done nothing.** The plan was to
inject the user's style rules with a bare `{style_rules}` template key. In a graph agent
node that does not resolve. It reaches the model as literal text, the model never sees a
single rule, and every visible part of the feature still works: rules save, display, and
toggle. The demo would have looked flawless. The feature would have been
a prop. The fix is a code node that returns a typed `AssetGenInput` so the generator can
use `{AssetGenInput.style_rules}`, which is the supported form. No model is ever asked to
carry a list of rules forward.

**An elimination-class configuration bug.** An early draft pinned a model below the
mandatory floor. Stage One is pass/fail, so that alone would have removed the entry. It is
now an assert at import rather than a line in a document.

Smaller ones that cost real time: `FirestoreSessionService`, the durable session backend
that would have held a paused run, is ADK Java only with no Python equivalent. PyGithub's
`create_file` returns 422 on a file that already exists, so the second run of the same
project fails unless you read the existing SHA first and update instead. And because Cloud
Run recycles containers, a run interrupted mid-graph stays at `RUNNING` forever with no code
left alive to write its ending, so every cold start now sweeps stranded rows.

## Accomplishments that we're proud of

The verification ledger. Every claim about the framework in my documentation now cites a
primary source, and where a document disagrees with the ledger, the ledger wins. Product
decisions and API claims are tracked separately, because they fail in different ways.

Catching the fake-memory bug before it shipped, and knowing what the test for it has to
prove. A test that asserts generation succeeded cannot tell a working memory system from a
demonstration of one. The only test that can is: toggle a rule, regenerate, assert the draft
actually changed. That test is written next, but the standard it has to meet is what saved
the feature, and the fix is already in the code.

Failure handling that is specific rather than general. Every step writes its state before it
fails, and each failure gets its own status: `FAILED_SCAN`, `FAILED_EXTRACTION`,
`FAILED_GENERATION`. The two publish commits are tracked as independent flags, so if one
succeeds and the other fails you get a retry scoped to the failed piece instead of a second
full approval. The path evaluator defaults to `PRIVATE_ONLY` on any failure, because
nothing should ever be published on the strength of a score that was never computed.

And one governance pattern applied consistently: every consequential decision in the system,
publish-or-private and rule activation both, passes through exactly one human confirmation.
Nothing runs on a clock. Every write to memory is triggered by a person pasting a URL or
clicking Approve.

## What we learned

A demo that works and a system that works are different things, and the gap between them is
invisible from the outside. The `{style_rules}` bug is the cleanest example I have ever hit
personally: every visible surface behaved correctly while the feature underneath was inert.
I now write the test that would fail if the feature were a prop, before I trust that it
isn't.

Verify the framework against the installed package, not against what you remember reading.
Fluent documentation is not evidence. Most of my worst claims were fluent.

Keep decisions and facts in separate documents with separate rules about which one wins. My
product decisions survived the audit almost untouched. My API claims did not. Mixing them
into one document would have meant re-litigating good decisions to fix bad facts.

## What's next for Project Sync

Near term, in order:

1. Finish the test suite, starting with the rule-toggle test that proves the memory system
   is not decorative.
2. Record the publish gate firing for real. I will run the agent against an early commit of
   ProjectSync's own history, from before the README was finished, and contrast it with the
   final commit. That branch may never fire against a finished repo, and a gate you cannot
   show is a gate a judge has no reason to believe.
3. Deploy to Cloud Run and confirm the Phase 1 to Phase 2 handoff survives the container
   being recycled in between, which is the whole architectural bet.

After that: a live portfolio site as a second publish target instead of only a JSON card in
a private repo, and calendar reminders so a finished project gets a nudge to actually post
it. Both are deliberately parked. Calendar writes need three-legged OAuth tied to a personal
account, which is the same multi-day setup cost that got the Gmail approval flow cut from
this build in the first place.

Longer term the interesting direction is more memory, not more outputs. Right now the
curator looks for patterns in edits across projects. It could also learn which projects are
worth writing up at all, which is a harder and more useful question than how to word the
post.
