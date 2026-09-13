# Setup: hook and settings

Run as the last step of mode 1, after the profile file exists and the user has
approved the rules.

Everything here was run and verified on Claude Code 2.1.270 on Windows 11 with
Node 24.

**Every command on this page is for you to run through Bash, not for the user
to type.** Ask for a yes, then run it yourself. A user who is handed a `node`
command to paste has been failed by a skill whose entire purpose is making
Claude easier to work with.

## Why a hook at all

A skill only runs when someone invokes it. If Claude has already drifted into
long answers, the user has to notice and type a command — which is the same
effort as typing "shorter please", so the skill has added nothing.

The hook is different. The harness runs it, not the model. It cannot be
forgotten, skimmed, or pushed out by a long conversation.

`SessionStart` fires on startup, resume, `/clear` and `/compact`. Those four
events are exactly when a `CLAUDE.md` instruction loses its grip, which is why
this is the layer that makes the difference.

## Ask before touching anything

`install.mjs` writes to `settings.json` and `CLAUDE.md`. Show the user the
`--dry-run` output and get an explicit yes.

```bash
node .claude/skills/speaksimple/scripts/install.mjs --install --dry-run
```

## Choosing the scope

**Scope is not a flag. It is where the skill is installed.**

| Skill installed at | Style file | Settings | CLAUDE.md | Applies in |
|---|---|---|---|---|
| `<project>/.claude/skills/speaksimple/` | in that folder | `<project>/.claude/settings.json` | `<project>/CLAUDE.md` | that project |
| `<project>/.agents/skills/speaksimple/` | in that folder | `<project>/.claude/settings.json` | `<project>/CLAUDE.md` | that project |
| `~/.claude/skills/speaksimple/` | in that folder | `~/.claude/settings.json` | `~/.claude/CLAUDE.md` | every project |
| `~/.agents/skills/speaksimple/` | in that folder | `~/.claude/settings.json` | `~/.claude/CLAUDE.md` | every project |

Any `<base>/.<agent>/skills/` folder counts, because the `skills` CLI writes a
different agent folder for each client. The config the installer edits is always
Claude Code's `.claude`: hooks and `CLAUDE.md` are Claude Code features, and the
folder the skill sits in decides the scope, not which client put it there.

The style file lives inside the skill folder, so the two can never disagree.
`--check` reports `skill.installedAs` as `project`, `global`, or `unmanaged`.

The scope is chosen once, at install time, in one of two ways:

```bash
npx skills add anodeaGr/speaksimple-skill
```

The CLI asks "this project, or all projects" and writes the folder to match.
This is the normal route, and it is what [INSTALL.md](../INSTALL.md) documents.

```bash
node <skill>/scripts/install.mjs --to project    # or --to global
```

This copies an unmanaged source folder into the matching skills folder. Use it
when the user has a checkout and no CLI.

An installed skill is never moved after that: moving it would silently change
which projects the style applies to.

## Install

```bash
node .claude/skills/speaksimple/scripts/install.mjs --install
```

Verified behaviour:

- Backs up `settings.json` and `CLAUDE.md` first, to
  `<file>.speaksimple-backup-<ISO timestamp>`.
- Leaves every other setting and hook untouched — tested against a settings
  file containing an unrelated `PreToolUse` hook and a `model` key.
- Idempotent. Running it twice leaves exactly one `SessionStart` entry.
- Refuses, with exit code 1, if `settings.json` is not valid JSON, rather than
  overwriting it.
- Puts the block at the **top** of `CLAUDE.md`, above existing content.

`--install` points the hook at this skill's own copy of
`speaksimple-context.mjs`, and writes the exact style-file path into the hook
command as `--profile`. The hook then loads that file or nothing. It never
searches, so a style file left somewhere else can never be picked up by
surprise.

`--install` does **not** move the skill. Moving it would change which projects
the style applies to. A copy that is not installed anywhere is placed with
`--to project` or `--to global` first.

Nothing belonging to this skill is written outside the skill folder. The style
file, named styles and reports all live inside it.

Resulting hook entry:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"<skill folder>/scripts/speaksimple-context.mjs\" --profile \"<skill folder>/UserCommunicationProfile.md\""
          }
        ],
        "matcher": "startup|resume|clear|compact"
      }
    ]
  }
}
```

The matcher is a regular expression; the alternation was tested and fires
correctly.

## The every-turn option

```bash
node .claude/skills/speaksimple/scripts/install.mjs --install --every-turn
```

Adds a `UserPromptSubmit` hook that re-injects the rules on every message.

Only offer this if the user reports drift *within* a session, after the
`SessionStart` hook is already installed. It works — verified — but it spends
tokens on every turn to solve a problem the user may not have. Start with the
cheap layer and escalate on evidence.

Re-running `--install` without the flag removes the every-turn hook again.

## Verify it actually works

Two levels. Do the first always; do the second if the user doubts it, or if
something is not behaving.

**1. Configuration check** — instant, no tokens:

```bash
node .claude/skills/speaksimple/scripts/install.mjs --check
```

Look for `"ready": true`. It means both the hook and the profile exist; either
one alone does nothing.

**2. End-to-end check** — proves the text really reaches the model:

```bash
claude -p --model claude-haiku-4-5-20251001 "Quote the first rule under 'How to talk to this user' in your context. If there is no such section, print NONE."
```

This is how the mechanism was confirmed in the first place. A marker string
placed in a hook came back verbatim through `claude -p`. If this prints `NONE`,
the hook is not reaching the model and the configuration check was not enough.

## What to expect once it is on

Measured with a real profile, same question asked with and without the hook,
on Haiku 4.5.

**Reliably changes:** ordering and vocabulary. "Use an atomic int for a simple
counter" as the opening line instead of a paragraph building up to it.
"Faster and simpler" instead of "lock-free read-modify-write". Structural rules
like *answer first* land well, because they say what to do rather than what to
avoid.

**Applied loosely:** hard length limits. "Under 8 lines" is treated as pressure
towards brevity, not a cap — a smaller model in particular will overshoot it.

**Correctly ignored when it should be:** the escape hatch works. A question
phrased as *"what is X and why is it hard"* got the long teaching answer, which
is what the profile's "when I ask you to explain, these limits are off" line
asks for. That is the rule doing its job, not failing.

**The off switch is strong.** Measured on Opus 5 with a live hook: the same
question answered 18 lines with the style on, and 83 lines with
`/speaksimple --off`. A direct instruction in the current turn beats context
injected at session start, comfortably.

Set expectations honestly when handing over. This makes answers markedly more
readable; it is not a formatter, and a profile written as if it were will
disappoint.

## Where the files live

| File | Path | Why there |
|---|---|---|
| The style | `<skill folder>/UserCommunicationProfile.md` | Beside the skill that owns it, so scope cannot disagree with location |
| Named styles | `<skill folder>/profiles/<name>.md` | In a subfolder, so deleting data never touches skill code |
| Reports | `<skill folder>/metalearning_<N>.md` | Beside the style they describe |
| The skill | `~/.claude/skills/speaksimple/` or `<project>/.claude/skills/speaksimple/` | Its location is the scope |
| The hook entry | `settings.json` in the matching config dir | Marked, backed up, removable |
| The rules block | `CLAUDE.md` in the matching config dir | Marked, backed up, removable |

**Always show the style file's path when you mention it.** State a user cannot
locate is state a user cannot trust. This rule exists because an earlier
version defaulted the style to the home directory and told a user in an empty
project that they had a saved style, with nothing on screen to confirm it.

The hook command also carries the exact path: `--profile "<path>"`. The hook
loads that file or nothing. It never searches, so a leftover style file
somewhere else can never be picked up by surprise.

## Uninstall

```bash
node .claude/skills/speaksimple/scripts/install.mjs --uninstall
```

Removes both hooks and the `CLAUDE.md` block, backing up first. Verified to
restore the file to its exact prior content. The style file is deliberately
kept, so the user can reinstall without redoing the interview.

Add `--purge` to delete the style file and any reports as well. Confirm before
running it: the style took the user five minutes to produce and nothing else
can regenerate it. The output lists every file it deleted.

`--purge` is the answer to "let me start completely clean". Without it there
is no way back to a fresh state, and the next help run announces a saved style
the user has forgotten creating.

## Troubleshooting

**`--check` says `ready: false` but the profile exists.**
The hook is not in `settings.json`. Run `--install`. If it was installed under
a project copy and you are checking the global one, check the other.

**Hook installed, profile exists, but nothing changes in a running session.**
`SessionStart` fires at session start. An already-open session never ran it.
Restart, or `/clear`. Always say this at handover — it is the single most
common reason someone thinks the setup failed.

**It worked, then stopped, with no error.**
Check `hookScript.exists` in `--check`. If it is false, the file the hook
points at is gone — usually the skill folder was moved or deleted. Re-run
`--install` from the skill's current location to repair it.

**The hook produces no output when run by hand.**
That is the designed response to a missing or unreadable profile — silence and
exit 0, so a broken profile can never stop a session from starting. Check the
path in `--check` output, and confirm the file contains the
`<!-- SPEAKSIMPLE:BEGIN -->` marker. Without that marker the hook falls back to
the file's first section, which is usually the title.

**`REFUSING: ... is not valid JSON`.**
The settings file was already broken before this ran. Fix the JSON by hand;
the installer will not write over a file it cannot parse.

**Windows paths.**
The installer writes forward slashes into the JSON command string. Backslashes
in JSON need escaping and are a common source of silently broken hooks.

## What is deliberately not used

**Output styles** (`~/.claude/output-styles/`) exist in this version and would
be a stronger layer still, since they edit the system prompt rather than adding
context. They are not used because they are a mode the user has to select, they
replace rather than add, and they are harder to reverse. If someone wants
maximum enforcement, mention it as an option — do not install it silently.
