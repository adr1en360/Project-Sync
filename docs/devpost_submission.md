## Inspiration

I build a lot of projects: hackathon entries, developer utilities, prototypes to test an idea. Almost none of them ever get a portfolio entry, a resume line, or a post.

The code is not the bottleneck. The bottleneck is that once a project is finished, writing it up is a separate job with none of the fun in it. You have to re-read your own repo, remember what was hard, decide what a stranger would care about, and then write the same facts four different ways for four different audiences. It is boring enough that it gets skipped, and it gets skipped every time, so the work stays invisible.

ProjectSync is the thing I wanted for myself: paste a repo URL, get the four write-ups, approve them once, done. I ran it on the repo that builds it, because why not.


## What It Does

You paste a GitHub URL into the review desk and click one button.

ProjectSync reads the repository and writes four things: a documentation sheet, a portfolio card, a draft of resume bullets, and a draft post for LinkedIn or X.

Then it does something less common. A third agent looks at the repo and decides whether it is actually fit to show a stranger, and recommends either publishing it fully or keeping it private. "Fit to show" here does not mean the code runs. It means there is a real README, no secret sitting in a file, no leftover TODO in a file that matters. A project can work perfectly and still fail this check, which is exactly what happens to real hackathon repos built under time pressure.

Nothing is published until you say so. The four drafts land on a review desk where you can edit any of them, regenerate any single one, and then approve or discard. On approve it commits the documentation sheet and the portfolio card into a private repo you own, and records both commits so you can go check them.

That last part matters more to me than it sounds. Everything ProjectSync makes ends up in repositories you already own, written with your own GitHub token. There is no ProjectSync database holding your work and no format only ProjectSync can read. You could delete the whole thing tomorrow and keep every file it ever made for you.

The part I care about most is the memory. Every edit you make is kept. After a couple of approved projects, a curator agent reads the before-and-after pairs of your own edits and suggests a rule in your own voice: do not open a post with "Excited to share," name the constraint rather than the result. A suggested rule does nothing at all until you click once to turn it on. Rules that are on get read fresh on every run, so switching one on changes the next draft with nothing to redeploy. You can also regenerate a review you are already looking at, so a rule you just learned applies to the project on screen.

Rules are either suggested, on, or off, and you can see and change all three. Turning down a suggestion switches it off instead of deleting it, so you can bring it back later.


## How We Built It

There are two halves, and the split between them is the one design decision I would defend hardest.

The first half is the agent run: seven steps in a fixed order, built as a Google ADK 2.0 graph workflow. Four of them are plain code and three call Gemini 3.5 Flash. One of the code steps is the handoff step described below. Reading a repository and throwing away the parts that do not matter is exact work, and using a model for a simple deterministic task seems wasteful, so the scanning step is code. It drops the folders and file types nobody needs, caps how much it will read from any single file, and stops at a few dozen files. That filtering happens before anything is sent to the model, not after, because otherwise a normal repo fills the model's entire attention with somebody else's dependency code.

The handoff step is there for a duller reason. Each step reads whatever the step before it produced, and the step before the reviewer is the one writing the drafts. Left alone, the reviewer would sit down to grade the four finished write-ups instead of the repository they came from, which is the wrong object entirely. So one small step hands it the repository facts instead.

The second half is not an agent run at all. It is an ordinary web app. The seven-node graph runs once, start to finish, inside a single request: it scans the repo, writes the four drafts, and persists a pending record to Firestore. Then the run is over. Nothing about that run needs to survive between requests, so it uses ADK's in-memory session service rather than a durable one. There is no session left to keep alive once the request ends. ADK does not ship a Firestore-backed session service anyway, and the durable options it does have would mean standing up a second database for a session that never needs to outlive one request. The place a human decision lives is a row in Firestore, and the thing that turns that row into a GitHub commit is you clicking approve. That is not the agent resuming. It is a plain API call that reads the row, writes to GitHub, and updates the status.

Two Google services, which is one more than the minimum. One runs the app. The other holds both kinds of memory: the rows are the record of what happened, and the rules are what it learned about how I write. There is no message queue, because the only thing that ever starts a run is a person pasting a URL, and there is nothing to decouple from that.

The interface is plain HTML, CSS, and JavaScript with a React frontend, served by the same app that runs the agents: one thing to deploy. It polls for status every few seconds instead of holding a connection open the whole time.


## Challenges We Ran Into

Three specific traps came out of that audit.

The first was a right decision held up by a wrong reason. I had written that the framework has no way to handle a human decision that arrives hours later. That is false: ADK's graph runtime can pause a node and resume it later. Keeping the approval step outside the agent run is still the right call, but not for that reason, because the agent's job is finished before a human ever needs to look at anything, so there was nothing to pause in the first place. Being wrong about your tool can cost more credibility than a good design choice earns.

The second would have demoed perfectly and done nothing. My first attempt at handing the model your saved voice rules used a dotted placeholder in the instruction string. ADK's template engine only resolves a name that is a plain identifier, or one carrying an app:, user:, or temp: prefix. A name with a dot in it does not match, so the engine left the braces exactly as written and Gemini received the literal placeholder text instead of your rules. Nothing raised an error. Every visible part of the feature kept working exactly as designed: rules save, rules display, rules switch on and off. The demo would have looked flawless and the feature would have been a prop. The fix moves the rules out of the instruction template entirely: a code node fetches them from Firestore and attaches them to a typed input object, and the agent reads them straight off that object instead of through a curly-brace substitution.

The third was small enough to end the entry. An early draft pinned a model older than the competition rules allow. The first round is pass or fail, so that one line would have removed us before anyone looked at the work. It is now a check the app makes on startup instead of a sentence in a document.

Smaller things that still cost real time. Writing a file to GitHub fails outright if the file is already there, so the second run on the same project breaks unless you look up what exists and update it instead. And because the server recycles its containers, a run interrupted halfway through used to sit marked as "running" forever, with nothing left alive to write down how it ended, so now every cold start tidies up rows in that state.


## Accomplishments That We're Proud Of

Catching the fake-memory bug before it shipped, and working out what a test for it has to prove. A test that checks generation succeeded cannot tell a working memory system apart from a convincing imitation of one. The only test that can is: switch a rule on, regenerate, and check the draft actually came back different. That test is now written. It is switched off by default because it spends a real model call, and the free tier gives me about twenty of those a day.

Failure handling that is specific rather than general. Every step writes down where it got to before it is allowed to fail, and each kind of failure gets its own name, so you can tell a repo that could not be read from a model that would not answer. The two publish commits are tracked as separate flags, so if one lands and the other does not, you retry the piece that failed instead of the entire approval. And the reviewer defaults to private whenever anything goes wrong, because nothing should ever be published on the strength of a score that was never computed.

One rule applied everywhere it matters: every write to a repo or to memory passes through one human click. Nothing runs on a schedule. Every write starts with a person pasting a URL or clicking approve.


## What We Learned

A demo that works and a system that works are different things, and from the outside the gap between them is invisible. The rules bug is the cleanest example of that I have ever hit myself: every surface behaved correctly while the thing underneath was inert. I now write the test that would fail if the feature were a prop, before I let myself believe it is not one.

Check the framework against the package you installed, not against what you remember reading. Fluent documentation is not evidence. Most of my worst claims were fluent.

Keep decisions and facts in separate documents, with a clear rule about which one wins. My product decisions came through the audit almost untouched. My claims about the framework did not. Mixing the two into one document would have meant re-arguing good decisions to fix bad facts.


## What's Next for ProjectSync

ProjectSync is the first step toward a personal Career OS. Right now, developers scatter their work across messy READMEs, multiple resume versions, and old portfolio sites. ProjectSync points toward treating your career history like a software pipeline: separating the raw facts of what you built from how you present it.

It breaks down into three parts. First is the source code: unstructured project notes, hackathon logs, and learning records, stored in a private repository that is your headless backend.

Next is the compiler: language models that run on strict schemas to parse your raw notes, extract the actual technical skills, and compile a structured profile.

The last part is the executables. Because your experience is now structured and indexed in that backend, downstream engines can build exactly what you need on demand. This replaces the JSON card sitting in a private repo. Instead, you get a Next.js portfolio site that pulls from the backend and rebuilds itself automatically whenever you log a new project. You get one-page CVs that pull the right metrics and action verbs for a specific job application, and social posts written in your exact voice.

ProjectSync is not a documentation tool. It is about closing the gap between building something and having something to show for it: something that knows what you built, how you talk about it, and which pieces of your work are worth putting in front of people.
