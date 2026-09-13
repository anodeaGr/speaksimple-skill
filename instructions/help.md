# Help mode

Triggered by `/speaksimple`, `/speaksimple help`, `/speaksimple --help`.

## Step 1 — Read the state first

Run: `node <skill>/scripts/install.mjs --check`

## Step 2 — Branch on `profile.exists`

**`profile.exists: false` and the user typed a bare `/speaksimple`:**

Do not print help. There is no menu to show.

1. Run: `node <skill>/scripts/help.mjs --starting-interview`
2. Print that output verbatim.
3. In the **same message**, go to
   [mode-1-learn.md](mode-1-learn.md) step 2 and ask interview question 1.

Do not stop. Do not ask permission. Do not say "type /speaksimple learn".

**Everything else** — a style already exists, or the user explicitly typed
`help`, `--help` or `help full` — continue to step 3.

## Step 3 — Print the help

1. Pick the right one:
   - `--help`, `help full`, "all the options", "what can this do" ->
     `node <skill>/scripts/help.mjs --help` (every command, grouped)
   - `help` or a bare `/speaksimple` with a style already saved ->
     `node <skill>/scripts/help.mjs` (short status, one next action)
2. Print its output **verbatim**. Do not reformat it. Do not turn the columns
   into markdown tables. Do not add an introduction, a summary, or your own
   commentary.
3. Add nothing after it. The output already ends with the one action to take
   next. A "which one?" question puts a menu back and undoes the point of the
   script.
4. **STOP.** Wait for the user.

## Why the branch exists

A menu is the wrong answer to an empty project. Two of the three commands need
a style file that does not exist, so there is nothing to choose between. The
one correct path is the interview.

Showing help there added a decision and a second command to a path that needed
neither, and it made the skill feel like paperwork before anything happened.
When the answer is forced, do it rather than describing it.

Help is still right when a style exists. Then the reader has real choices:
revise it, apply it here only, or review whether it works.

## Routing after the user answers

| They say | Go to |
|---|---|
| learn, 1, setup, start | [mode-1-learn.md](mode-1-learn.md) |
| translate, 2, apply | [mode-2-translate.md](mode-2-translate.md) |
| re-align, realign, 3, review | [mode-3-realign.md](mode-3-realign.md) |
| full, more, detail, all the options, what can it do | rerun `help.mjs --help`, print verbatim, stop again |
| remove, uninstall | [setup.md](setup.md), Uninstall section. Keeps the style file. |
| delete my style, start again, reset | [setup.md](setup.md), Uninstall with `--purge`. Confirm first: it cannot be undone. |
| --off, not this one, normal answer please | [mode-off.md](mode-off.md), one-answer branch |
| off, disable, stop using my style | [mode-off.md](mode-off.md), `--disable` |
| on, enable, use my style again | [mode-off.md](mode-off.md), `--enable` |
| formats, styles, other formats, all the formats | [mode-formats.md](mode-formats.md) |
| check, verify, is it working, is it on | Run `scripts/help.mjs --verify`, print verbatim, stop |
| repair, fix | [setup.md](setup.md), run `--install` again |
| install for all projects / for this project only | [setup.md](setup.md), `install.mjs --to global` or `--to project` |
