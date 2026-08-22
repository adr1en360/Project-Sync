# ProjectSync Devpost submission

Plain-language draft for the Taskmaster track, All Things Agentic Hackathon. Paste each
section into the matching Devpost field. Written 2026-08-22.

## Inspiration

I build a lot of projects. Hackathon entries, side tools, things I start on a weekend
because I want to know if they work. Almost none of them ever get a portfolio entry, a
resume line, or a post.

The code is not the bottleneck. The bottleneck is that once a project is finished, writing
it up is a separate job with none of the fun in it. You have to re-read your own repo,
remember what was hard, decide what a stranger would care about, and then write the same
facts four different ways for four different audiences. It is boring enough that it gets
skipped, and it gets skipped every time, so the work stays invisible.

ProjectSync is the thing I wanted for myself: paste a repo URL, get the four write-ups,
approve them once, done. The test repo is its own repository. I ran the tool on the codebase
that builds the tool.

## What it does

You paste a GitHub URL into the review desk and click one button.

ProjectSync reads the repository and writes four things: a documentation sheet, a portfolio
card, a draft of resume bullets, and a draft post for LinkedIn or X.

Then it does something less usual. A third agent looks at the repo and decides whether it is
actually fit to show a stranger, and recommends either publishing it fully or keeping it
private. "Fit to show" here does not mean the code runs. It means there is a real README, no
secret sitting in a file, no leftover TODO in a file that matters. A project can work
perfectly and still fail this check, which is exactly what happens to real hackathon repos
built under time pressure.

Nothing is published until you say so. The four drafts land on a review desk where you can
edit any of them, regenerate any single one, and then approve or discard. On approve it
commits the documentation sheet and the portfolio card into a private repo you own, and
records both commits so you can go and check them.

That last part matters more to me than it sounds. Everything ProjectSync makes ends up in
repositories you already own, written with your own GitHub token. There is no ProjectSync
database holding your work and no format only ProjectSync can read. You could delete the
whole thing tomorrow and keep every file it ever made for you.

The part I care about most is the memory. Every edit you make is kept. After a couple of
approved projects, a curator agent reads the before-and-after pairs of your own edits and
suggests a rule in your own voice: do not open a post with "Excited to share", name the
constraint rather than the result. A suggested rule does nothing at all until you click once
to turn it on. Rules that are on get read fresh on every run, so switching one on changes the
next draft with nothing to redeploy. You can also regenerate a review you are already looking
at, so a rule you just learned applies to the project on screen.

Rules are either suggested, on, or off, and you can see and change all three. Turning down a
suggestion switches it off instead of deleting it, so you can bring it back later.

## How we built it

There are two halves, and the split between them is the one design decision I would defend
hardest.

The first half is the agent run: seven steps in a fixed order. Three of them are plain code,
three are the model, and one is a small handoff step. Reading a repository and throwing away
the parts that do not matter is exact work, and a model does it worse than code does, so the
scanning step is code. It drops the folders and file types nobody needs, caps how much it
will read from any single file, and stops at a few dozen files. That filtering happens before
anything is sent to the model, not after, because otherwise a normal repo fills the model's
entire attention with somebody else's dependency code.

The handoff step is there for a duller reason. Each step reads whatever the step before it
produced, and the step before the reviewer is the one writing the drafts. Left alone, the
reviewer would sit down to grade the four finished write-ups instead of the repository they
came from, which is the wrong object entirely. So one small step hands it the repository facts
instead.

The second half is not an agent run at all. It is an ordinary web app. The framework does have
a way to pause a run and wait for a person, but the server goes to sleep when nobody is using
it, so a paused run's process is long gone by the time you come back hours later to approve
something. Instead, the place a run stops is a row in the database, and the thing that starts
it again is you clicking a button. That is a decision about surviving failure, not a limit of
the framework.

Two Google services, which is one more than the minimum. One runs the app. The other holds
both kinds of memory: the rows are the record of what happened, and the rules are what it
learned about how I write. There is no message queue, because the only thing that ever starts
a run is a person pasting a URL, and there is nothing to decouple from that.

The interface is React, and the build turns it into plain files that the same app sends, so the
app that runs the agents also serves the page. One thing to deploy, and no Node in the image,
because the build happens before the image is made. A run takes roughly
30 to 90 seconds, so the page asks for the status every few seconds rather than holding a
connection open the whole time.

The model version is pinned in code and checked when the app starts. Point it at a model older
than the rules allow and it refuses to boot.

## Challenges we ran into

The hardest problem was not code. It was that my own documentation was confidently wrong.

I wrote the first pass of documentation before anyone had checked the framework's actual
behaviour line by line. It read beautifully and it was full of invented detail: a prize table
that does not exist, webinars that never happened, a 100-point scoring scale that is not how
the judging works. When I finally audited it, 22 of 36 files asserted at least one thing that
had already been cut or corrected. I kept the whole thing as a frozen log instead of deleting
it, because it records how the errors got in.

Three specific traps came out of that audit.

The first was a right decision held up by a wrong reason. I had written that the framework has
no way to handle a human decision that arrives hours later. That is false. It does have one.
Keeping the approval step outside the agent run is still the right call, but for a completely
different reason, and a judge who knows the framework would have spotted the false claim
immediately. Being wrong about your tools costs more credibility than a good design choice
earns.

The second would have demoed perfectly and done nothing. My plan for handing the model your
saved rules used a placeholder in the prompt, the kind that gets filled in with real values
before the model sees it. In this kind of step it does not get filled in. The model would have
received the placeholder as literal text and never seen a single one of your rules, while
every visible part of the feature kept working exactly as designed: rules save, rules display,
rules switch on and off. The demo would have looked flawless and the feature would have been a
prop. The fix passes the rules through in a form the framework actually resolves, and no model
is ever asked to carry the list forward on trust.

The third was small enough to end the entry. An early draft pinned a model older than the
competition rules allow. The first round is pass or fail, so that one line would have removed
us before anyone looked at the work. It is now a check the app makes on startup instead of a
sentence in a document.

Smaller things that still cost real time. The durable session storage that would have held a
paused run turned out to exist only for Java, with no Python equivalent. Writing a file to
GitHub fails outright if the file is already there, so the second run on the same project
breaks unless you look up what exists and update it instead. And because the server recycles
its containers, a run interrupted halfway through used to sit marked as "running" forever, with
nothing left alive to write down how it ended, so now every cold start tidies up rows in that
state.

## Accomplishments that we're proud of

The verification ledger. Every claim about the framework in my documentation now points at a
primary source, and where a document disagrees with the ledger, the ledger wins. Product
decisions and framework facts are tracked separately, because they go wrong in different ways
and need different evidence.

Catching the fake-memory bug before it shipped, and working out what a test for it has to
prove. A test that checks generation succeeded cannot tell a working memory system apart from
a convincing imitation of one. The only test that can is: switch a rule on, regenerate, and
check the draft actually came back different. That test is now written. It is switched off by
default because it spends a real model call, and the free tier gives me about twenty of those
a day.

Failure handling that is specific rather than general. Every step writes down where it got to
before it is allowed to fail, and each kind of failure gets its own name, so you can tell a
repo that could not be read from a model that would not answer. The two publish commits are
tracked as separate flags, so if one lands and the other does not, you retry the piece that
failed instead of the entire approval. And the reviewer defaults to private whenever anything
goes wrong, because nothing should ever be published on the strength of a score that was never
computed.

One rule applied consistently everywhere it matters: every consequential decision in the
system, publishing and rule activation both, passes through exactly one human confirmation.
Nothing runs on a schedule. Every write to memory starts with a person pasting a URL or
clicking approve.

## What we learned

A demo that works and a system that works are different things, and from the outside the gap
between them is invisible. The rules bug is the cleanest example of that I have ever hit
myself: every surface behaved correctly while the thing underneath was inert. I now write the
test that would fail if the feature were a prop, before I let myself believe it isn't one.

Check the framework against the package you installed, not against what you remember reading.
Fluent documentation is not evidence. Most of my worst claims were fluent.

Keep decisions and facts in separate documents, with a clear rule about which one wins. My
product decisions came through the audit almost untouched. My claims about the framework did
not. Mixing the two into one document would have meant re-arguing good decisions in order to
fix bad facts.

## What's next for Project Sync

Near term, in order.

Run the memory test for real and keep the output. It is written and it is off by default
because each run of it costs a live model call, which means I have never actually watched it
fire. Until I do, the feature is proven in code and unproven in practice.

Record the publish gate turning something down. I want to run the agent against an early
commit of ProjectSync's own history, from before the README was finished, and put it next to
the same repo today. That branch may never fire against a finished project, and a gate nobody
can watch working is a gate a judge has no reason to believe in.

Deploy it, then confirm the handoff between the two halves survives the container being
recycled in between. That is the whole architectural bet, and it is the one thing I cannot
fully test on my own machine.

After that, two things I deliberately parked. A live portfolio site as a second publish
target, instead of only a card sitting in a private repo. And calendar reminders, so a
finished project gets a nudge to actually go and post about it. Both need the kind of account
linking that takes days to set up properly, which is the same cost that got the email approval
flow cut from this build in the first place.

Longer term the interesting direction is more memory, not more outputs. Right now the curator
looks for patterns in how I edit. It could also learn which projects are worth writing up at
all, which is a harder and more useful question than how to word the post.
