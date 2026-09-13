---
name: speaksimple
description: Learn how a specific human wants Claude to write, save it as a UserCommunicationProfile.md, and enforce it with a CLAUDE.md block plus a SessionStart hook so it survives /clear and /compact. Use this skill whenever the user asks Claude to change how it explains things, says answers are too long, too technical, too detailed or hard to follow, asks for simpler or shorter or plain-language replies, wants Claude to remember their communication preferences, mentions a communication or writing profile, mentions plain language standards (ISO 24495-1, ASD-STE100, Easy Read, Information Mapping, DITA, Mayer), asks to set up or repair the style hook, or wants to review past sessions to check whether the current style is actually working. Accepts --install to set itself up after "npx skills add anodeaGr/speaksimple-skill": it checks where it is installed, runs the interview if there is no style yet, and wires the SessionStart hook. Also use it for "speaksimple", "/speaksimple", "learn how I talk", "re-align my style", or any request to make Claude's answers easier for this particular person to read.
---

# SpeakSimple

## The problem this solves

A capable model writes long, hedged, context-heavy answers. That is a good
default for a reader who wants everything. It is the wrong default for a reader
who is scanning, or tired, or reading in a second language, or who just wants
the one line that unblocks them.

Telling Claude "be shorter" fixes one message. The next session starts over.
People end up re-typing the same correction for months and slowly conclude the
tool does not listen.

SpeakSimple fixes the durable version of that problem: it works out how *this*
person wants to be written to, records it, and wires it in at a level that
survives forgetting.

## What it does not solve

It changes how answers are written, not whether they are correct. If Claude is
doing the wrong work, this skill will not help, and mode 3 deliberately keeps
those two kinds of complaint apart. Retuning prose because a script deleted the
wrong folder makes things worse.

## Dispatch

Match the argument, read that one file, follow its numbered steps. Nothing
here is a judgement call.

| Argument | Read | First action |
|---|---|---|
| `--off` [`<question>`] | [instructions/mode-off.md](instructions/mode-off.md) | **Ignore the style for this one answer.** Write nothing. |
| `off`, `disable`, `stop` | same | Run `install.mjs --disable` |
| `on`, `enable`, `resume` | same | Run `install.mjs --enable` |
| `--install`, `install`, `set up` | the `--install` mode below, nothing else | Run `scripts/install.mjs --gate` |
| **nothing** (bare `/speaksimple`) | [instructions/help.md](instructions/help.md) | Run `scripts/install.mjs --check`. **No style file -> announce and start the interview immediately, no menu.** Style exists -> print help. |
| `--help`, `help full` | same | Run `scripts/help.mjs --help`. **Every command, grouped.** Print verbatim, stop. |
| `help` | same | Run `scripts/help.mjs`. Short status and one next action. |
| `learn`, `learnUser`, `setup` | [instructions/mode-1-learn.md](instructions/mode-1-learn.md) | Run `scripts/install.mjs --check`, branch on step 1 |
| `translate`, `apply` [`<name>`] | [instructions/mode-2-translate.md](instructions/mode-2-translate.md) | Locate the profile |
| `re-align`, `realign`, `review` | [instructions/mode-3-realign.md](instructions/mode-3-realign.md) | Run `scripts/analyze-sessions.mjs` |
| `formats`, `styles`, "show me all the formats" | [instructions/mode-formats.md](instructions/mode-formats.md) | Render the last answer in all ten frameworks |
| `check`, `verify` | [instructions/help.md](instructions/help.md) | Run `scripts/help.mjs --verify`, print verbatim, stop |
| "install for all projects" / "for this project" | [instructions/setup.md](instructions/setup.md) | Run `install.mjs --to global` or `--to project`. Only valid when `--check` says `installedAs: unmanaged`. |
| `remove`, `uninstall` | [instructions/setup.md](instructions/setup.md) | Confirm, then `--uninstall` |
| `repair`, `fix` | [instructions/setup.md](instructions/setup.md) | Re-run `--install` |
| anything else | [instructions/help.md](instructions/help.md) | Treat as help |

Read **only** the dispatched file. Every other file here is reference material
loaded when a step names it. Reading them all first is how a five-line
interaction turns into a lecture.

## `--install` mode

Trigger: the user message has `--install`. Also use this mode when the user asks
to install this skill, or to set it up after `npx skills add anodeaGr/speaksimple-skill`.

**Run the four commands below, in order. Run nothing else.**

Forbidden in this mode. Do not do any of these:

- Do not read `README.md` or `INSTALL.md`.
- Do not run `ls`, `dir`, `find`, `cat`, `head`, `sed` or `type`.
- Do not look in `.claude`, `.agents` or `skills-lock.json`.
- Do not write the style file by hand.

`<SKILL_DIR>` is the folder that holds this file. You know this path. Do not
search for it. Put quotation marks around each path. Never write `~` in a
command: PowerShell and cmd do not change `~` to the home folder.

### Command 1 — the gate. Always first.

```bash
node "<SKILL_DIR>/scripts/install.mjs" --gate
```

This command prints `PASS` or `FAIL` on the first line. It changes nothing.

| First line | Your action |
|---|---|
| `FAIL` | **STOP.** Show the output. Run no other command. |
| `PASS` | Read the `scope:` line. Go to command 2. |

**On `FAIL`, stop immediately.** Do not look for the skill folder yourself. Do not
list folders. The output already holds the correct command. Show it and wait.

### Command 2 — the check

```bash
node "<SKILL_DIR>/scripts/install.mjs" --check
```

Read the `profile.exists` field. It decides the next step.

| `profile.exists` | Your action |
|---|---|
| `false` | The user has no style yet. Read [instructions/mode-1-learn.md](instructions/mode-1-learn.md) and follow it. Mode 1 ends with the install. Do not run command 3 here. |
| `true` | A style exists. Go to command 3. |

### Command 3 — wire the hook

Say the `scope:` line from command 1 to the user. Then say that this changes two
files: `settings.json` and `CLAUDE.md`. Say that both are backed up first.

**Get a yes. Then run this command.**

```bash
node "<SKILL_DIR>/scripts/install.mjs" --install
```

Confirm that the output shows `"sessionStartHook": true`. If it does not, show the
output and stop.

### Command 4 — report

```bash
node "<SKILL_DIR>/scripts/help.mjs" --after-install
```

Print the output verbatim. Add nothing.

The hook runs at session start, so it has not run in the current session. This is
correct. It is not an error. The report already says so.

## How the profile actually reaches Claude

Four layers, weakest to strongest. Mode 1 installs all of them, because each
one covers a case the others miss.

1. **`UserCommunicationProfile.md`** - the full reasoning. Rarely read; it is
   the source of truth the other layers are generated from.
2. **A marked block at the top of `CLAUDE.md`** - loaded with the project.
   Fails when the user is in a different project, or when the file is long and
   the block gets skimmed.
3. **A `SessionStart` hook** - the harness runs it on startup, resume, `/clear`
   and `/compact`. This is the layer that makes the profile reliable, because
   the harness executes it whether or not the model remembers to look. Those
   four events are precisely when memory files lose their grip.
4. **Optional `UserPromptSubmit` hook** - re-injects every single turn. Beats
   long-session drift; costs tokens on every message. Off by default.

Setup details, exact JSON, and the verification command:
[instructions/setup.md](instructions/setup.md).

## Layout

```
speaksimple/
  SKILL.md                  <- you are here: routing only
  README.md                 <- the repository front page, for humans
  INSTALL.md                <- how to install it, for humans
  instructions/             <- one file per mode, plus setup and help
  references/               <- frameworks.md, profile-schema.md, architecture.md
  prompts/                  <- interview questions and calibration samples
  scripts/                  <- the five executables
  assets/                   <- the profile template
```

Scripts, all plain Node with no dependencies:

| Script | Used by | Purpose |
|---|---|---|
| `scripts/install.mjs` | mode 1 | Installs/removes the hook and the CLAUDE.md block. Backs up first, idempotent, `--dry-run` available. |
| `scripts/speaksimple-context.mjs` | the hook itself | Reads the profile, prints the rules as `additionalContext`. Never fails loudly. |
| `scripts/recommend.mjs` | mode 1 | Scores all ten frameworks from the interview answers, overall and per task type. Says when a second profile is justified. |
| `scripts/analyze-sessions.mjs` | mode 3 | Mines past transcripts for evidence that the style is or is not working. |
| `scripts/help.mjs` | help, mode 1, off | All fixed user-facing text: short status, `--help` (every command), `--starting-interview`, `--after-install`, `--verify`. Print its output verbatim. |

Before changing anything in here, read
[references/architecture.md](references/architecture.md) - it records why each
piece is shaped the way it is, including the mistakes that were measured and
corrected.

## Rules that apply in every mode

**Write everything the user reads in ASD-STE100 Simplified Technical English.**
Not only the profile output — your own messages, in every mode. The rules:

- One instruction per sentence. Under 20 words.
- Imperative verbs for instructions. "Type this", not "you can type this".
- Active voice. Simple present tense.
- No idioms. "Wire it in", "up and running", "start here" are all banned.
- One word for one meaning. Always "style", "setup", "hook" — never a synonym.
- Number the steps when there is more than one.

**Give one next action, never a menu.** A menu makes the reader understand the
whole system before they can do anything. At any moment there is one correct
next step. Give that step. `scripts/help.mjs` already works out which one it
is from the current state.

**Output budget: 10 lines per message.** A limit, not a target. This skill
exists because a capable model writes more than the reader wants. Long
messages while running it teach the user in thirty seconds that it does not
work.

Two deliberate exceptions, both asked for by name: `--help`, which must list
every command or it is not a reference, and `formats`, where the renderings
are the output. In both the long part is generated or quoted text, and your
own words around it stay at one line.

Where a step says "print verbatim", print the script's output unchanged. Do
not re-render it, expand its columns into tables, or add an introduction or a
summary. It is generated precisely so that it is identical every time.

**Steps are in `instructions/`. Reasoning is in `references/`.** Follow the
steps; read a reference only when a step names it. The reasoning is there for
whoever maintains this skill, not for the user, and not for you mid-task.
Reading rationale during execution is what produces rationale-shaped output.

**The user never runs a command. You do.** Every script here is run by you
through Bash. Do not hand the user a command line to paste, ever — not for
install, not for check, not for uninstall. This skill is for people who want
Claude to be easier to work with; telling them to go and run a Node script is
the same failure in a different costume. If something needs doing, ask for a
yes and then do it.

**Write the way the profile says, starting immediately.** A skill that
explains plain language in six dense paragraphs has already failed. Once you
have read a profile, your own next message follows it.

**Ask before writing, then actually write.** `install.mjs` edits
`settings.json` and `CLAUDE.md`. Show what will change and get a yes first —
global config is the one thing a person lets a tool touch exactly once. Then
run it and confirm `ready: true`. Stopping at the yes leaves the user believing
they are set up when they are not; that happened on the first real run.

**Skill code lives in one folder.** `--install` relocates the skill to
`~/.claude/skills/speaksimple/` so the hook has a permanent address and the
skill loads in every project. Nothing but the user's own profile is written
outside it.

**Prefer showing over asking.** People cannot reliably answer "do you like
short answers?" in the abstract. They can instantly pick their favourite from
four versions of the same paragraph. Mode 1 is built on that.
