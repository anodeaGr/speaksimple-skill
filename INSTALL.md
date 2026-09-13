# Install

This page tells you how to install the skill. Do one step at a time.

---

## Before you start

You must have two things.

**1. Node.js 18 or later.**

To see your version, type this command:

```bash
node --version
```

**2. A client that reads Agent Skills.**

Claude Code is the client this skill is built for. The hook layer is a Claude Code
feature. The skill loads in Cursor and Codex too, but only Claude Code runs the hook.

You do not need a project of any kind. This skill works in any folder.

---

## Step 1 — Install the skill

Type this command:

```bash
npx skills add anodeaGr/speaksimple
```

The tool asks two questions:

1. Which agent do you use? Select your agent.
2. Do you want this project only, or all projects? Select one.

**Answer 2 decides who the style is for.** Read the table:

| Your answer | The style applies to | The files change in |
|---|---|---|
| All projects | every project on this computer | your home folder |
| This project only | this project | this project folder |

You cannot move the skill later. The location **is** the scope. To change the scope,
uninstall the skill and install it again.

On Windows, the tool can show a symlink error. If this occurs, add `--copy`:

```bash
npx skills add anodeaGr/speaksimple --copy
```

---

## Step 2 — Set up the style

Tell your agent:

```
/speaksimple --install
```

The agent runs four commands, and nothing else:

1. `--gate` — it prints `PASS` or `FAIL`. On `FAIL`, the agent stops.
2. `--check` — it looks for your style file.
3. The interview, or the installer. See the table.
4. The report — it shows the result.

| Do you have a style file? | What the agent does |
|---|---|
| No | It starts the interview. The interview takes five minutes. It then installs the hook. |
| Yes | It asks for a yes. It then installs the hook. |

The interview shows you four versions of the same answer. You pick your favourite.
It does not ask you to describe your taste.

### The manual way

Use this way if you do not use an agent.

Give the full path to the installer. Never write `~` on Windows: PowerShell and cmd do
not change `~` to your home folder.

If you installed the skill for all projects, macOS or Linux:

```bash
node ~/.agents/skills/speaksimple/scripts/install.mjs --install
```

If you installed the skill for all projects, Windows PowerShell:

```powershell
node "$env:USERPROFILE\.agents\skills\speaksimple\scripts\install.mjs" --install
```

If you installed the skill for this project only:

```bash
node .agents/skills/speaksimple/scripts/install.mjs --install
```

Your client can use `.claude` in place of `.agents`. Use the folder that holds the skill.

> **Warning**
> The installer writes to `settings.json` and to `CLAUDE.md`. It makes a backup of each
> file first. Add `--dry-run` to see the changes and write nothing.

---

## Step 3 — Restart your client

The hook runs at session start. A session that is already open never ran it.

Close your client. Then start your client again. Or type `/clear`.

---

## Step 4 — Check the install

Tell your agent:

```
/speaksimple check
```

The command shows the state of each part. It changes nothing.

A correct install shows `"ready": true`.

Then do one more check. Ask a question that usually gets a long answer. A short answer
means the style works.

---

## If there is a problem

| Message or problem | Cause | What to do |
|---|---|---|
| `REFUSING: this copy of the skill is not installed` | The folder is not a skills folder. | Install it with `npx skills add anodeaGr/speaksimple`. |
| `--gate` prints `FAIL` | Same cause. | Same action. The output holds the command. |
| `Cannot find module 'C:\...\~\.agents\...'` | You used `~` on Windows. | Use `$env:USERPROFILE` or `%USERPROFILE%`. |
| `"ready": false`, but the style file exists | The hook is not in `settings.json`. | Run `--install` again. |
| Nothing changes in the open session | `SessionStart` hooks fire at session start. | Restart the client. Or type `/clear`. |
| It worked, then it stopped | The skill folder moved or was deleted. | Run `--install` again from the new location. |
| `REFUSING: ... is not valid JSON` | The settings file was already broken. | Repair the JSON by hand. The installer does not write over a file it cannot read. |
| `hookScript.exists` is `false` | The hook points at a file that is gone. | Run `--install` again. |
| `EPERM` on Windows | Windows blocked a symlink. | Add `--copy` to the `skills add` command. |
| The style is too strong or too weak | The first style is a guess from five answers. | Type `/speaksimple learn`. Choose revise. |

---

## Options

Every option below belongs to `scripts/install.mjs`.

| Option | Function |
|---|---|
| `--gate` | Print `PASS` or `FAIL` only. Exit code: 0 = PASS, 1 = FAIL. |
| `--check` | Show the state of each part as JSON. Change nothing. |
| `--install` | Wire the hook and the `CLAUDE.md` block. |
| `--install --every-turn` | Also wire a `UserPromptSubmit` hook. It costs tokens on every message. |
| `--dry-run` | Show the changes. Write nothing. |
| `--disable` / `--enable` | Turn the style off and on. Delete nothing. |
| `--uninstall` | Remove the hook and the block. Keep the style file. |
| `--uninstall --purge` | Remove them and delete the style file too. This cannot be undone. |
| `--to global` / `--to project` | Copy an uninstalled source folder into a skills folder. |

The installer is safe to run again. It adds the missing parts. It does not remove your
other settings or your other hooks.

---

## Where the files go

| File | Path |
|---|---|
| The skill | `~/.agents/skills/speaksimple/` or `<project>/.agents/skills/speaksimple/` |
| Your style | `<skill folder>/UserCommunicationProfile.md` |
| The hook entry | `settings.json` in the matching `.claude` folder |
| The rules block | `CLAUDE.md` in the matching `.claude` folder |

Your style stays inside the skill folder. Nothing that belongs to this skill is written
anywhere else.

---

## Other tools

### Claude Cowork

Cowork has no command line tool. Do these steps:

1. Make a ZIP file of the `speaksimple` folder.
2. Make sure that the folder is at the top of the ZIP file.
3. Open Cowork.
4. Click **Customize**.
5. Click **+**.
6. Click the **Skills** tab.
7. Upload the ZIP file.

Cowork does not run hooks. The skill works, but the style does not load automatically.

### Cursor and Codex

`npx skills add` installs the skill for these clients. The skill and the interview work.
The `SessionStart` hook is a Claude Code feature, so the style does not load
automatically. Type `/speaksimple` in each session.

---

## Uninstall

Tell your agent:

```
/speaksimple remove
```

This removes the hook and the `CLAUDE.md` block. It restores both files from a backup.
It keeps your style file, so you do not repeat the interview.

To delete the style file too, tell the agent that you want to start clean. The agent then
adds `--purge`. This cannot be undone.

---

## Sources

- skills CLI — https://github.com/vercel-labs/skills
- Claude Code hooks — https://code.claude.com/docs/en/hooks
- Agent Skills — https://code.claude.com/docs/en/skills
