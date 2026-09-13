# speaksimple

**An Agent Skill that works out how *you* want Claude to write, records it, and enforces it
in every session — instead of you re-typing "shorter, please" for the rest of your life.**

It runs a five-minute interview, scores your answers against ten published communication
standards, writes a `UserCommunicationProfile.md`, and wires that profile into a `SessionStart`
hook so it survives `/clear`, `/compact` and every new session.

Works with Claude Code. The profile itself is plain markdown and portable to any agent that can
read a file at session start.

---

## Status

**Early development. Shared with the community for feedback.**

The interview, the framework recommender, the profile format and the hook chain all work today
and were verified against a real Claude Code install. The meta-cognition mode (`re-align`) is
**still in test** — it reads your real transcripts and proposes a profile change, and its
signal patterns are honest but not yet proven at scale. Treat its output as a proposal to argue
with, which is exactly how it presents itself.

Expect changes between versions rather than a frozen spec. Issues and disagreement are the
point of publishing it this early.

---

## The problem

Capable models — Opus in particular — have a house style: long, hedged, context-first,
everything-you-might-need-in-case. It is a defensible default for a reader who wants the whole
picture. It is the wrong default for almost every real moment of work.

What it costs, in order of how much it actually hurts:

- **You stop reading.** The answer is on screen and you skim it, or scroll past it, or close
  it. The work was done and it did not arrive.
- **You cannot find the answer.** The verdict is in paragraph four, after three paragraphs of
  framing you did not ask for.
- **You pay twice.** You re-ask, more narrowly, to get the version you wanted first. Two
  answers billed, one used.
- **It is worse in a second language.** Idioms, phrasal verbs and synonym variation are the
  expensive part, and native-speaker writers do not notice they are doing it.
- **The correction does not stick.** "Be shorter" fixes exactly one message. The next session
  starts from the same default, so you correct it again, and again, and eventually conclude the
  tool does not listen.

That last one is the real defect. Every individual answer looks reasonable. The *relationship*
degrades, because nothing carries your preference from one session to the next.

## The solution

SpeakSimple replaces a repeated correction with a stored, named, enforceable style.

Three things make it work:

1. **Recognition, not description.** People cannot reliably answer "do you like short
   answers?". They can instantly pick their favourite from four versions of the same paragraph.
   The interview is built on that, using `AskUserQuestion` previews to show real text side by
   side.
2. **Named standards, not vibes.** The result is one of ten published communication frameworks
   — ISO 24495-1, ASD-STE100, Easy Read, Information Mapping, DITA and others — chosen by a
   scoring script, not by the model's impression. A named standard is testable and auditable;
   "be clearer" is not.
3. **A hook, not a memory.** The style is injected by the harness at session start, so it
   cannot be forgotten, skimmed, or pushed out of context by a long conversation.

The agent does not merely *know* your preference. The preference arrives before the agent
starts writing, every time.

---

## How it works

### 1. The interview — five steps, about five minutes

| Step | What it asks | What it decides |
|---|---|---|
| **1. Context** | What you use Claude for · Is English your first language · What you do when an answer arrives (read it all / skim / read the first lines / copy the command) | Vocabulary discipline and the **structure** rule |
| **2. Calibration A** | The same concept written four ways — which do you want when learning something new? | The base shape |
| **3. Calibration B** | The same *decision* written four ways — which shape here? | Whether you need one style or per-task-type rules |
| **4. The dials** | How much reasoning you want · what to ban (preambles, hedging, emoji, tables) | The reasoning rule and the Never list |
| **5. The open one** | "What annoys you most about how Claude answers you right now?" | The specific, unguessable rule — kept close to verbatim |

Two rules the interview holds itself to. A different pick in steps 2 and 3 is the most valuable
signal in the whole thing: it means you want teaching when learning and a verdict when working,
and the profile should say so rather than averaging them. And before anything is proposed,
every answer is accounted for out loud — became a rule, or was deliberately dropped. That check
exists because in a real run an answer was politely recorded and then silently forgotten.

### 2. The recommender — ten frameworks, scored

`scripts/recommend.mjs` takes the interview answers as JSON and scores **all ten** frameworks,
overall and per task type (`quick_qa`, `explain`, `build`, `debug`, `plan`).

This is a script rather than a judgement call for a reason. The interview can only ever *show*
four options at a time, but your answers carry evidence about all ten — so the right base is
regularly one you were never shown. A model asked to weigh that gives a different answer each
run and no way to audit it.

It reports probabilities, not a single winner, because a person is rarely one style. A tie is
reported as `draw`, not as whichever option sorted first. A second profile is recommended from
a number: a task appears in `perTaskRulesNeeded` when its best framework beats the overall base
by at least 4 points for that task.

The ten frameworks:

| Framework | Controls | Best for |
|---|---|---|
| **ISO 24495-1 Plain Language** | Clarity, relevance, findability | General explanation. The safe default. |
| **ASD-STE100** | Vocabulary, grammar, sentence construction | Procedures and steps; second-language readers |
| **Easy Read** | Words, complexity, layout, images | Complete beginners; genuinely hard ideas |
| **Information Mapping** | Chunking, labels, hierarchy | Readers who scan rather than read |
| **DITA information typing** | Concept vs Task vs Reference | "I asked *how*, you told me *what*" |
| **Google Developer Style** | Structure, vocabulary, voice | Technical readers who want less padding |
| **Microsoft Writing Style** | Terminology, clarity, voice | Same niche, slightly warmer |
| **Caterpillar Technical English** | Controlled vocabulary and grammar | Consistency across translation |
| **Attempto Controlled English** | Controlled syntax and semantics | Zero ambiguity; too rigid for explanation |
| **Mayer's multimedia principles** | Cognitive load, words paired with visuals | Anything with diagrams or slides |

All ten are rendered on one shared example in
[references/frameworks.md](references/frameworks.md), so every style has a specification rather
than a name. `/speaksimple formats` re-renders your last answer in all ten on demand — "all"
has to mean all.

### 3. The profile — one file, one enforceable block

The interview produces `UserCommunicationProfile.md`: the reasoning, the evidence, the
changelog, and one block fenced by exact markers that is the part Claude actually receives.

```
<!-- SPEAKSIMPLE:BEGIN -->
- Answer in the first line. Reasoning after, if it changes what I'd do.
- Under 8 lines unless I ask for more.
- Plain words. No idioms - English is my second language.
- No emoji. No "Great question". No apologies.
- Code: give the command or diff first, explain under it.
- When I say "explain" or "why", the limits above are off. Teach me properly.
<!-- SPEAKSIMPLE:END -->
```

Every line is checkable. "The user prefers concision" is not a rule — it describes a person
instead of telling the reader what to do, and advice loses to a model's defaults. The block is
kept under about 1,200 characters, because it is re-injected on every session start.

The last line is mandatory in every profile. Without an escape hatch, profiles decay into
answers too thin to use, and people rarely complain in words a script can detect. They just
stop asking.

### 4. Four layers of enforcement

Weakest to strongest. Setup installs all of them, because each covers a case the others miss.

| Layer | What it is | Fails when |
|---|---|---|
| `UserCommunicationProfile.md` | The full reasoning, source of truth | Rarely read — it is what the other layers are generated from |
| A marked block in `CLAUDE.md` | Loaded with the project | You are in another project, or the file is long and the block gets skimmed |
| **A `SessionStart` hook** | The harness runs it on startup, resume, `/clear`, `/compact` | Almost never — this is the layer that makes it reliable |
| Optional `UserPromptSubmit` hook | Re-injects on every message | Costs tokens every turn. Off by default; offer it only on evidence of within-session drift |

The hook carries the exact style path as `--profile "<path>"`. It loads that file or nothing,
and never searches — so a leftover style file somewhere else can never be picked up by
surprise.

### 5. Meta-cognition — `re-align` (experimental)

This is the part that is still in test, and the most interesting thing here.

A profile written from a five-minute interview is a hypothesis. `/speaksimple re-align` checks
it against what actually happened: `scripts/analyze-sessions.mjs` reads your past Claude Code
transcripts, finds the moments where you asked for a *different style*, and produces a
`metalearning_<N>.md` report plus a proposed profile edit that you approve or refuse.

Verified throughput: 500 sessions, 3,304 human messages, 8.5 seconds.

Why a script and not "Claude, read my sessions": in one real transcript, 47 lines had
`type: "user"` and exactly **two** were written by a person. The rest were tool results, hook
injections, command caveats and attachments. The script does the filtering and counting; the
model does the judgement, which is the part it is good at.

The guard rails matter more than the feature, and they are deliberate:

- **Style complaints and task complaints are counted separately.** On the real corpus, "the
  work went wrong" outnumbered "write it differently" roughly 2.5:1. Merged, that made a
  working style look like a failing one. Only style signals may change a profile. Retuning your
  prose because a script deleted the wrong folder makes everything worse.
- **Sample size gates the conclusion.** Under 10 style-repair messages, the verdict is *not
  enough evidence* and nothing is proposed. 10–29 allows one provisional change. 30+ allows
  per-task-type changes. Stopping is a real result — a profile edited monthly on thin evidence
  drifts away from what you wanted, and every single edit looks justified at the time.
- **Every match is quoted with the pattern that fired it.** Pattern matching over free text
  produces candidates, not facts. The first version of these patterns ran about 75% false
  positives: *"a simple task"* counted as *asked for simpler language*. The report has a
  **Discarded** section, and the number you rejected is part of the output.
- **It proposes; it never applies.** Approval is explicit, the change is dated in the profile's
  changelog, and the justification is recorded beside it.

Answer length is reported too, and it is a good example of the mode earning its keep: measured
on a real corpus, the median answer length before a style complaint was 1,623 characters
against 2,043 before a normal turn. Length was *not* the problem. Cutting it would have been
the obvious fix and the wrong one.

---

## Commands

| Command | What it does |
|---|---|
| `/speaksimple` | With no style saved: starts the interview immediately, no menu. With a style: status and one next action. |
| `/speaksimple learn` | Make or revise your style. Five questions, five minutes. You approve the rules before anything is saved. |
| `/speaksimple check` | Proves the setup works — runs the hook exactly as the harness would and prints the rules that came back. One second, no tokens. |
| `/speaksimple formats` | Re-renders the last answer in all ten styles plus the unstyled default. `formats 4` shows the four most different. |
| `/speaksimple translate [name]` | Apply your style, or a named alternate, in this chat only. Saves nothing. |
| `/speaksimple --off [question]` | Off for one answer. |
| `/speaksimple off` / `on` | Off until you turn it back on. The style file and the hook stay; a `DISABLED` flag is what changes. |
| `/speaksimple re-align` | Read past sessions, write a meta-learning report, propose a change. Use it after some weeks of real work. |
| `repair speaksimple` | Install the hook again. |
| `remove speaksimple` | Remove the hook and the `CLAUDE.md` block. Your style file is kept. |

**You never type a node command.** Every script here is run by the agent through Bash. A skill
whose purpose is making Claude easier to work with does not hand you a shell command to paste.

---

## Install

You need Node.js 18 or later, and Claude Code.

### Step 1 — add the skill

```bash
npx skills add anodeaGr/speaksimple
```

On Windows, add `--copy` if you see a symlink error.

### Step 2 — choose the scope

**Scope is not a flag. It is where the skill is installed** — and the style file lives inside
the skill folder, so the two can never disagree.

| Skill installed at | Your style applies to |
|---|---|
| `~/.claude/skills/speaksimple/` | every project |
| `<project>/.claude/skills/speaksimple/` | that project only |

Then tell your agent:

```
/speaksimple
```

It reads the current state and does the right thing: places the copy, runs the interview, shows
you the rules, asks for a yes, then installs the hook and the `CLAUDE.md` block.

### Step 3 — nothing

There is no step 3. The hook fires at session *start*, so setup applies your style to the
current conversation by hand, and tells you that a restart is what makes it automatic in future
sessions. An earlier version ended with "now restart" and people reasonably concluded it was
broken.

### Safety

- `settings.json` and `CLAUDE.md` are backed up before either is touched, to
  `<file>.speaksimple-backup-<timestamp>`.
- Both edits are fenced by markers, and `--uninstall` restores the exact prior content.
- The installer is idempotent — running it twice leaves one hook entry — and refuses with a
  non-zero exit rather than overwriting a `settings.json` it cannot parse.
- Nothing belonging to this skill is written outside the skill folder. Your style, your named
  styles and your reports are all in one directory.
- `--uninstall --purge` deletes your style too, and lists every file it removed. It is opt-in,
  because the style is the one artifact here that cost you five minutes of attention and cannot
  be regenerated from anything else.

---

## What this does not do

It changes **how** answers are written, not **whether they are correct**. If Claude is doing the
wrong work, this will not help — and `re-align` deliberately keeps those two kinds of complaint
apart.

It is not a formatter. Measured honestly: ordering and vocabulary rules land reliably; hard
length limits are treated as pressure towards brevity rather than a cap, and smaller models
overshoot them. Structural rules like *answer first* work well, because they say what to do
rather than what to avoid. A profile written as if this were a formatter will disappoint.

Plain language is also not less information. Every framework rendering in
[references/frameworks.md](references/frameworks.md) states the same true thing, cause included.
A profile that produces confident but hollow answers has misapplied all of it.

---

## Repository contents

| Path | |
|---|---|
| `SKILL.md` | the skill — routing, the four layers, the rules that apply in every mode |
| `instructions/` | one file per mode, plus setup and help. Numbered steps, literal output templates, explicit stop points |
| `references/frameworks.md` | the ten frameworks, all rendered on one shared example |
| `references/profile-schema.md` | the profile file shape and the marker contract |
| `references/architecture.md` | why each piece is shaped this way, including what was measured and rejected |
| `prompts/interview.md` | the five interview steps and the answer-to-rule mapping |
| `prompts/calibration-samples.md` | the A–D option sets |
| `scripts/install.mjs` | installs and removes the hook and the `CLAUDE.md` block |
| `scripts/speaksimple-context.mjs` | the hook itself — reads the profile, prints the rules, never fails loudly |
| `scripts/recommend.mjs` | scores all ten frameworks from the interview answers |
| `scripts/analyze-sessions.mjs` | mines past transcripts for evidence (meta-cognition) |
| `scripts/help.mjs` | all fixed user-facing text, generated so it is identical every run |
| `assets/UserCommunicationProfile.template.md` | the starting point for a profile |

No dependencies. Plain Node, no `package.json`, no build step — a style tool that needs
`npm install` before it can remind Claude to write shorter sentences will not survive contact
with a new machine.

[references/architecture.md](references/architecture.md) is worth reading if you plan to change
anything. It is a record of measured failures, kept because each one is tempting enough to be
reinvented: ALL-CAPS as a frustration signal (acronyms triggered it constantly), fuzzy word
matching (*"simple"* is one edit from *"simpler"*), showing four of ten frameworks and calling
it the choice, and a help screen that — on Opus 5 at high effort — expanded into ninety lines of
box-drawn tables. A skill about not producing walls of text, producing one, on the user's first
interaction. That is why fixed text is now generated by a script and printed verbatim.

---

## Verified environment

Measured on 2026-09-13: Claude Code 2.1.270, Windows 11, Node 24.15.0.

| Fact | How it was checked |
|---|---|
| `SessionStart` hooks inject context the model reads | Marker string round-tripped through `claude -p` |
| The `matcher` field accepts regex alternation | `startup\|resume\|clear\|compact` fired on startup |
| `UserPromptSubmit` hooks do the same | Second marker, same test |
| A `DISABLED` flag silences the hook completely | Hook run by hand emits nothing, exit 0 |
| `--off` overrides an active hook for one answer | Same question, same project: 18 lines with the style on, 83 lines with `--off`. Opus 5. |
| Most `type: "user"` transcript lines are not human | One session: 47 user lines, 2 human |

If a future version breaks one of these, the round-trip test in
[instructions/setup.md](instructions/setup.md) is the fastest way to find which layer failed.

---

## Feedback

This is an early release of an idea I think is under-served: agents are tuned for an average
reader who does not exist, and the fix is not a better average — it is a per-person, stored,
enforceable style. The meta-cognition mode is the part most likely to be wrong, and the part I
most want reports on. Open an issue with what it proposed and what you made of it.

---

## License

**MIT.** Free to use, modify, distribute and use commercially. See [LICENSE](LICENSE) for the
full terms.

Note: this skill modifies local configuration files (`settings.json` and `CLAUDE.md`, both
backed up and marker-fenced) and reads your local Claude Code transcripts when you run
`re-align`. Nothing leaves your machine. Review it before use.

## Author

**Kostas Ordoumpozanis** — Founder, [Anodea](https://github.com/anodeaGr).
