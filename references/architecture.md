# Architecture and maintenance

Read this before changing anything in `scripts/`. It records the contracts
between the pieces and the things that were measured and turned out to be
wrong, so they do not get reintroduced.

## Contents

- [File map](#file-map)
- [Contracts](#contracts)
- [Verified environment facts](#verified-environment-facts)
- [Things tried and rejected](#things-tried-and-rejected)
- [Test checklist](#test-checklist)

## File map

| Path | Role | Changes when |
|---|---|---|
| `SKILL.md` | Routing and the four-layer model | A mode is added or renamed |
| `instructions/help.md` | Four steps: run `help.mjs`, print verbatim, stop | Routing changes |
| `scripts/help.mjs` | All fixed user-facing text: short help, `--full`, `--starting-interview`, `--after-install`, `--verify` | Any wording the user reads changes |
| `instructions/mode-1-learn.md` | Interview → profile → install | The mode 1 sequence changes |
| `instructions/mode-2-translate.md` | Applying a profile in-session | Profile resolution order changes |
| `instructions/mode-3-realign.md` | Reading the analyser output | The analyser's report shape changes |
| `instructions/mode-off.md` | The three off switches | Off behaviour changes |
| `instructions/mode-formats.md` | Rendering one answer in all ten frameworks | A framework is added or removed |
| `instructions/setup.md` | Hooks and settings | Claude Code's hook API changes |
| `references/frameworks.md` | The ten frameworks, worked examples | Rarely |
| `references/profile-schema.md` | Profile file shape | The markers or sections change |
| `references/architecture.md` | This file | Any structural change |
| `prompts/interview.md` | The five interview steps | Interview design changes |
| `prompts/calibration-samples.md` | The A–D option sets | New samples are added |
| `scripts/install.mjs` | Writes hooks and the CLAUDE.md block | Hook API or scope rules change |
| `scripts/speaksimple-context.mjs` | The hook itself | Profile location or output shape changes |
| `scripts/recommend.mjs` | The framework scoring matrix | A framework is added, or a weight is wrong |
| `scripts/analyze-sessions.mjs` | Mode 3 evidence gathering | Transcript format or signal patterns change |
| `assets/UserCommunicationProfile.template.md` | Starting point for a profile | Schema changes |

Nothing here has dependencies. Plain Node, no `package.json`, no install step.
That is deliberate: a style tool that needs `npm install` before it can remind
Claude to write shorter sentences will not survive contact with a new machine.

## Contracts

Three couplings. Break one and the chain fails, in two cases silently.

**1. The profile markers.**

```
<!-- SPEAKSIMPLE:BEGIN -->  ...  <!-- SPEAKSIMPLE:END -->
```

Read by `speaksimple-context.mjs` (to build the injected context) and by
`install.mjs` (to build the CLAUDE.md block). Exact string match. Change them
in one place and the hook quietly falls back to the file's first section —
usually the title — which looks like it is working.

**1b. Where the skill lives, and therefore where the hook points.**

`--install` relocates the whole skill to `~/.claude/skills/speaksimple/` and
points the hook at `scripts/speaksimple-context.mjs` inside it.

That is Claude Code's user-level skill directory — verified in the CLI as the
location for "skills that work in any project". It never changes, which is the
property a stored absolute path in `settings.json` needs.

Anywhere else is a temporary address. An earlier build pointed the hook at
whatever folder the skill happened to be in at install time; in testing that
was `C:/tmp/test SpeakSimple`. Deleting that folder would have broken the hook
silently, since it is designed never to interrupt a session.

An intermediate build copied just the hook script to `<base>/speaksimple/`.
That fixed the stability problem and introduced a worse one: skill code living
outside the skill folder, in two places, free to drift apart. `--uninstall`
still removes that old copy where one exists.

Nothing is written outside the skill folder now - not code, not the style
file. `--check` reports `skill.installedAs` and `hookScript.exists`, so both
failure modes are diagnosable.

**2. The hook output shape.**

```json
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"..."}}
```

Verified against Claude Code 2.1.270. Also verified with
`hookEventName: "UserPromptSubmit"`.

**3. The transcript filter.**

A real human message is `type === "user"`, `isSidechain !== true`, and
`origin.kind === "human"`.

`promptSource === "typed"` is deliberately **not** required. Voice dictation
and pasted text are still the person speaking, and requiring `typed` silently
drops everything from anyone who dictates.

## Verified environment facts

Measured on 2026-09-13, Claude Code 2.1.270, Windows 11, Node 24.15.0.

| Fact | How it was checked |
|---|---|
| `SessionStart` hooks inject context the model can read | Marker string round-tripped through `claude -p` |
| `--off` overrides an active hook for one answer | Same question, same project, style on: 18 lines. With `--off`: 83 lines. Opus 5. |
| A DISABLED flag silences the hook completely | Hook run by hand emits nothing, exit 0 |
| `UserPromptSubmit` hooks do the same | Second marker, same test |
| The `matcher` field accepts regex alternation | `"startup\|resume\|clear\|compact"` fired on startup |
| Transcripts live at `~/.claude/projects/<slug>/<sessionId>.jsonl` | Directory listing, 170 project folders |
| The slug is the cwd with every non-alphanumeric replaced by `-` | `C:\Anodea\_Anodea_Harness\docs` → `C--Anodea--Anodea-Harness-docs` |
| Most `type: "user"` lines are not human | One session: 47 user lines, 2 human |
| Output styles exist in this version | `output-styles` and `outputStyle` present in the CLI binary |

If a future version breaks something here, the round-trip test in
[../instructions/setup.md](../instructions/setup.md) is the fastest way to find
out which layer failed.

## Scope containment - the rule that outranks convenience

**THE SCOPE RULE: the style file lives where the skill lives.**

```
~/.claude/skills/speaksimple/          -> style applies to all projects
~/.agents/skills/speaksimple/          -> style applies to all projects
<project>/.claude/skills/speaksimple/  -> style applies to that project
<project>/.agents/skills/speaksimple/  -> style applies to that project
```

A skills folder is matched by shape - any `<base>/.<agent>/skills/<name>` - not
by the literal name `.claude`. The `skills` CLI writes a different agent folder
per client (`.claude`, `.agents`, `.cursor`, `.codex`), and an earlier version
of `classifyLocation` recognised only `.claude`, so every install the CLI
performed was reported as `unmanaged` and the skill refused to wire itself.
What makes a copy installed is that it sits in a skills folder; which client
put it there is not a scope fact.

The config the installer edits stays Claude Code's `.claude` in all four cases.
Hooks and `CLAUDE.md` are Claude Code features, so the agent folder decides the
scope and never the config location.

`UserCommunicationProfile.md` and `DISABLED` sit inside the skill folder,
beside `SKILL.md`. Scope is derived from `SKILL_ROOT`, never from a flag and
never from the working directory.

Every scope bug in this skill's history came from deriving the scope from
something other than the thing that owns the file: a `--scope` default, the
working directory, a fallback search. Those are all separate from the data, so
they can disagree with it. The skill folder cannot disagree with itself.

It also makes the rule checkable by eye. One directory holds the skill and its
data, so "where is my style?" has the same answer as "where is the skill?",
and nothing belonging to this skill exists anywhere else.

Scope is chosen exactly once, at install time, by whichever route put the
folder there: `npx skills add anodeaGr/speaksimple-skill` asking "this project or
all projects", or `--to global` / `--to project` copying an uninstalled source
folder. An installed skill is never relocated: relocating would silently change
which projects the style applies to.

**Never read, write, or report a path outside the scope in force.** Project
scope touches only the project directory. User scope touches only the home
directory. There is no fallback between them.

This is written first because breaking it was the worst defect in this skill's
history. Running a script from inside `~/.claude/skills/speaksimple` made the
".claude climb" yield `C:/Users/<name>`, which was then used as the project
root. A project-scoped run printed:

```
This project has a style file:
C:/Users/<name>/.claude/speaksimple/UserCommunicationProfile.md
```

A file from the user's home directory, presented as belonging to the folder
they were standing in. The user had not put it there and could not see why it
appeared.

Three defences now, because one was clearly not enough:

1. `resolveProjectDir()` refuses, exit 2, if the working directory resolves to
   the home directory or anywhere inside `~/.claude`. It does not guess.
2. `assertWithinScope()` runs at startup and exits 3 if any path to be used or
   reported falls outside the scope root. Before anything is read.
3. `speaksimple-context.mjs` has no home-directory fallback at all. With
   `--profile` it loads that file or nothing; without it, project only.

A silent widening of scope is worse than a crash. The user cannot see it
happen, so they cannot correct it, and every later message built on it is
wrong in a way that looks authoritative.

## Things tried and rejected

Kept because each one is tempting enough to be reinvented.

**ALL-CAPS as a frustration signal.** Removed. Acronyms in pasted text (ISO,
DITA, HUMANS, JSON) triggered it constantly. It measured formatting, not
feeling.

**Unrestricted fuzzy word matching.** Edit distance cannot tell a typo from a
different real word. "simple" is one edit from "simpler", so *a simple task*
was logged as *asked for simpler language*; "colaborate" is two from
"elaborate". Together these produced 54 of 68 style hits on the first real run.
Fixed with per-word `avoid` lists — any new fuzzy word needs one.

**Counting slash-command bodies as user writing.** A command's body is the
skill author's prose. The `/run-skill-generator` prompt contains the word
"concise", which registered as the user asking for shorter answers.
`cleanUserText()` now strips command scaffolding, system reminders and fenced
code before analysis.

**One "frustration" bucket.** Style complaints and task complaints were
counted together, which made a working writing style look like a failing one.
On the real corpus task frustration outnumbers style complaints roughly 2.5:1,
so the merged number was mostly noise pointing at the wrong thing. Now
separate, and only style signals may change a profile.

**Ambiguous phrases in the format detector.** "step by step", "in a list",
"numbered list", "more information" are far more often task requests than style
complaints. Removed. A smaller honest count beats a larger contaminated one,
because these counts are what profile edits get justified with.

**More than four options in an `AskUserQuestion` call.** The tool accepts 2–4
options per question and 4 questions per call. The banned-items question
listed six, which is a hard validation failure — the first real interview
showed the user an `Invalid tool parameters` error and then asked a duplicate
follow-up question to fit the leftovers. Capped at four, with "Other" carrying
the rest.

**Treating approval as completion.** The first real run ended immediately after
the user said "yes go ahead". The profile was written, the installer was never
executed, and the user reasonably believed setup had happened. Mode 1 now
requires running `--check` and seeing `ready: true` before reporting success.

**Collecting an interview answer with nothing consuming it.** The reading-
behaviour question was recorded in the profile's Evidence section and produced
no rule, so the profile said nothing about structure at all. There is now an
explicit answer-to-rule mapping and a checklist pass before proposing.

**Ending mode 1 without a handover.** The hook only fires on a new session, so
a user who does not restart sees no change and concludes it failed. There is
now a required handover block covering restart, how to test, and how to correct
the style — that last one especially, because someone who dislikes the result
and has not been told how to change it concludes the whole tool does not work.

**Fixed user-facing text living in a markdown instruction file.** The help was
prose in `help.md` under "show the text below". On Opus 5 at high effort that
produced roughly ninety lines: the model read it, re-rendered it, expanded the
tables into box-drawn grids and added its own framing. A skill about not
producing walls of text produced one, on the user's very first interaction.

Two fixes, both structural rather than a plea for brevity:

1. Text that must be identical every time is now generated by `help.mjs`. The
   agent runs it and prints stdout verbatim. There is nothing to interpret, so
   effort level cannot inflate it. 14 lines, measured on Opus 5.
2. `instructions/` holds numbered steps with literal output templates and
   explicit STOP points; `references/` holds the reasoning. Steps say which
   reference to read and when. Rationale read during execution comes back out
   as rationale-shaped output, so it is kept off the execution path.

There is also a stated 10-line output budget per message in `SKILL.md`. That
alone would not have been enough - a budget is advice, and a capable model
talks itself past advice. Generating the text is what makes it hold.

**Installing the style but not applying it.** Mode 1 finished the interview,
wrote the profile, installed the hook, and then told the user to restart. The
hook fires at session *start*, so the very next answer came back in the old
style - immediately after a screen saying the setup was complete.

In a real session (`eec96058`) the user worked around it: `/speaksimple off`
then `/speaksimple on`. The style then appeared, but not because the hook
fired. Running the command put the rules back into context as a side effect.
They had invented a workaround for a step the skill should have done itself.

Mode 1 and the `on` branch now read the profile and start following it in the
current session, and the handover leads with "I use your style from now on"
instead of "it does not work yet". The restart is still mentioned, but as what
makes it automatic in *future* sessions - not as the thing that makes it work
at all.

The general rule: when a tool cannot make a mechanism take effect immediately,
it does the mechanism's job by hand for the current turn rather than handing
the user a chore. Telling someone to restart before they can see any result is
how a working setup gets mistaken for a broken one.

**Assuming an instruction is enough to turn the style off.** `--off` for a
single answer is an override: the rules were injected at session start, are
already in context, and cannot be unsent. That is fine for one message, where a
direct request in the current turn is the strongest available signal.

It is not enough for "off until I say otherwise". `/compact`, `/clear` and the
next session all re-run the hook and the rules come straight back - a user who
switched the style off and watched it return ten minutes later has learned the
switch does not work. So persistent off is a DISABLED flag file the hook checks
before doing anything.

The flag, rather than removing the hook, keeps two states distinguishable:
`sessionStartHook: true, disabled: true` is "installed but off", which must not
look like "never installed" or the user gets sent back through the interview.

**Letting the model choose the framework by eye.** The interview collected
answers and then asked the model to pick a base from a prose decision list.
That gives a different answer each run, cannot be audited, and in practice
just echoed whichever calibration option the user had clicked - so six
frameworks were unreachable even after they were written down.

`recommend.mjs` scores all ten from the answers, overall and per task type,
and reports why. Two tuning mistakes were caught by running real personas
through it:

- **Softmax temperature 2.2** turned a three-point gap into "76% vs 20%", and
  a framework scoring 7 of a possible 16 into 1.3%. Numbers that overstate
  certainty stop the user questioning them. Now 4.5.
- **Task modifiers at half the weight of a calibration pick** could never
  close a base-score gap, so the overall winner won every task and
  `perTaskRulesNeeded` was always empty - the per-task feature existed but
  could not fire. Now +/-6, the same magnitude as direct evidence.

A tie is reported as `draw`, not as a winner. Presenting whichever option
sorted first would be a coin flip dressed as analysis.

**A help screen that listed some of the commands.** `help full` covered three
modes and left `check`, `formats`, `--off`, `off`, `on`, `repair`, `remove` and
the install options undiscoverable. Same defect as showing four of ten writing
styles: it quietly redefines "all" as "the ones I chose to mention".

`--help` now prints every command, grouped by what the reader wants to do
rather than by how the code is arranged. `--full` is an alias for the same
text, because two long help pages drift apart.

**Showing four frameworks and calling it the choice.** Ten frameworks are
documented. `AskUserQuestion` allows four options. The interview showed the
same four every time, so six were unreachable no matter what the user wanted -
and when a user asked to see an answer "in all the rest of the available
formats", three came back, because only four had ever been written down.

Two fixes. `references/frameworks.md` now renders all ten on one shared
example, so every style has a specification rather than a name. And the
calibration is spread across three sets - four frameworks each, the third
offered explicitly with "I can show you four more styles if none of these fit".

`/speaksimple formats` renders any answer in all ten on demand. "All" has to
mean all; quietly redefining it as "the ones I offered" is how a tool teaches
someone that its vocabulary is not trustworthy.

**No way for the user to prove the setup works.** `--check` reported that the
files exist, which is not the same as the rules reaching Claude. When a user
looked in their project and could not see a hook, the only available answer was
"trust me". After one failed install nobody does.

`/speaksimple check` now reads the hook command out of settings.json, RUNS it
exactly as the harness would, and prints the first rule that came back. It is
instant, costs no tokens, and fails honestly: hiding the style file makes it
report NOT FOUND rather than passing.

**Showing a menu when there was nothing to choose.** A bare `/speaksimple` in
a project with no style printed the help: three commands, a status block, and
"type /speaksimple learn". Two of those three commands need a style file that
does not exist. There was exactly one correct path, and the skill described it
instead of taking it.

Now a bare `/speaksimple` reads the state first. No style means: print the
`--starting-interview` text and ask question 1 in the same message. No menu, no
confirmation, no second command to type. `/speaksimple help` still prints help
whatever the state, because someone who asks for help wants help.

When the next action is forced, do it. Only offer a menu once the choices are
real - which they are as soon as a style exists.

**Resolving the project root from the working directory.** With a per-project
style, that path decides where the file goes. Running the script from inside
the skill folder produced
`<project>/.claude/skills/speaksimple/.claude/speaksimple/…` - a style nested
in the skill, which the hook would never load. `resolveProjectDir()` now
climbs out of any `.claude` segment, then walks up to the nearest `.git` or
`.claude`, and stops at the home directory. That last guard matters: without
it a new folder anywhere under `~` walked all the way up and wrote the
"project" style into `~/.claude`, quietly restoring the global behaviour this
change removed. Verified from six locations.

**Defaulting the style to the home directory.** The style used to be
per-person, saved in `~/.claude/speaksimple/`. The reasoning was sound - how
you want to be written to follows you between projects - and it was still
wrong, because it made a clean first run impossible.

Opening a brand new empty project reported a saved style, created weeks
earlier somewhere else. Nothing on screen could confirm it. The interview
never ran, and the skill offered to reuse a style the user had forgotten
making. A tool cannot be trialled if it will not start from nothing.

The style is now per project: `<project>/.claude/speaksimple/`. An empty
project genuinely has none, so `/speaksimple learn` always runs the interview,
and the file is written at the end of it and never before. This was later
superseded again: the style moved INTO the skill folder and the scope became
the skill's install location, which removed the flag entirely.

Two supporting changes went with it. The hook command carries the exact path
as `--profile "<path>"`, so the hook loads that file or nothing and never
searches - a leftover style elsewhere can no longer be picked up by surprise.
And mode 1 is now explicit that when no style exists there is no question to
ask and no shortcut to offer: do not look in other projects, do not offer to
copy, start the interview.

**Asserting state without showing where it is.** The help said "You have a
saved style" with no path. A user testing in an empty folder read that as
impossible - nothing in front of them could confirm it, so the tool looked
broken or haunted. The style was real, in `~/.claude/speaksimple/`, left from
an earlier interview.

The code was correct and the display was not. State a user cannot locate is
state a user cannot trust. Every status line now prints the file it is talking
about, and says in words that the style is per-person and not per-folder.

The same gap left no way back to a clean state: uninstalling kept the style,
so a later help run announced a saved style the user had forgotten making.
`--uninstall --purge` now deletes it and lists every file removed. It is
opt-in because the style is the one artifact here that took five minutes of
the user's attention and cannot be regenerated from anything else.

**Offering a menu instead of a next step.** The first short help listed all
three modes and ended with "Which one?". It was 14 lines and still unusable:
the reader had to understand the whole system before they could act. Nobody
could complete a setup from it.

Now `help.mjs` reads the current state and prints exactly one numbered
procedure. A first-time reader gets four steps and no choices. The other two
commands exist behind `--full`, for someone who asks.

**Writing user-facing text without applying the skill's own standard.** The
same help said "wires it in" and "<- start here". Both are idioms, which
ASD-STE100 forbids, and this skill recommends ASD-STE100 to second-language
readers. A tool that will not follow its own advice has no standing to give
it.

All fixed text is now written to STE rules, listed at the top of `help.mjs`
and in `SKILL.md`: one instruction per sentence, imperative verbs, active
voice, under 20 words, no idioms, one word per meaning. That last rule is why
the text says "style", "setup" and "hook" every time and never reaches for a
synonym.

**Handing the user a shell command.** When the install failed, the repair
offered was a `node ...` line to paste. For a skill whose whole purpose is
making Claude easier to work with, that is the same failure in a different
costume. Every script here is run by the agent through Bash; the user is asked
for a yes, never for a command. This is now a top-level rule in `SKILL.md`.

**`val()` testing truthiness.** `--exclude ""` means "exclude nothing", but an
empty string is falsy, so it silently fell back to the default exclusion and
returned zero results. It now tests for the argument's presence.

## Test checklist

Run these after any change to `scripts/`. They are the commands the pieces were
actually verified with.

```bash
# Syntax
node --check scripts/install.mjs
node --check scripts/speaksimple-context.mjs
node --check scripts/analyze-sessions.mjs

# Hook: silent with no profile, JSON with one, silent on a corrupt file
SPEAKSIMPLE_PROFILE=/nonexistent node scripts/speaksimple-context.mjs </dev/null; echo "exit=$?"
SPEAKSIMPLE_PROFILE=<a real profile> node scripts/speaksimple-context.mjs </dev/null

# Installer, against a throwaway directory - never test against real settings
cd /tmp/sandbox && node <source>/scripts/install.mjs --to project   # installs a copy
cd /tmp/sandbox && node .claude/skills/speaksimple/scripts/install.mjs --install
cd /tmp/sandbox && node .claude/skills/speaksimple/scripts/install.mjs --install   # still one entry
cd /tmp/sandbox && node .claude/skills/speaksimple/scripts/install.mjs --uninstall --purge
#   purge must remove UserCommunicationProfile.md, DISABLED, metalearning_*.md
#   and profiles/, and must leave SKILL.md and scripts/ untouched

# Analyser, on real data
node scripts/analyze-sessions.mjs --all --days 30 --max-sessions 50 --quiet | head -40
node scripts/analyze-sessions.mjs --project . --days 30 --quiet | head -20
```

For the installer, always use a sandbox directory. There is no faster way to
lose a user's trust than corrupting their `settings.json` while testing a tool
that was supposed to make Claude easier to read.

When adding a signal pattern to the analyser, run it over the real corpus and
read the `matchedBy` values before believing the count. Every pattern in there
now survived that check; several did not.
