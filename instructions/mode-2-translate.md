# Mode 2 — translate (apply the profile now)

`/speaksimple translate` or `/speaksimple translate <name>`

Writes nothing. Loads the rules into this conversation and follows them.

**Budget: two lines of your own output, then answer whatever the user was
actually doing.** This mode is a switch, not a conversation.

---

## Step 1 — Find the profile

| Argument | File |
|---|---|
| none | `<skill folder>/UserCommunicationProfile.md` |
| `<name>` | `<skill folder>/profiles/<name>.md` |

`<skill folder>` is where this skill is installed, and nothing is searched for
outside it. Run `node <skill>/scripts/install.mjs --check` to get the exact
path, or `ls <skill folder>/profiles/` to see the named styles.

Nothing found -> output two lines:
*"You have no saved style. To make one, type: /speaksimple learn"*
*"It takes 5 minutes."* **STOP.**

Never invent a style. A guessed profile is worse than none, because the user
will assume it came from their answers.

---

## Step 2 — Read all of it

The whole file, not just the marked block. In this mode you have the
per-task-type rules and the Evidence section available; the compressed block
does not carry them.

---

## Step 3 — Restate and continue

Output, in this order:

1. The rules, as a short list. This anchors them in recent context instead of
   leaving them far back in the conversation.
2. One line that names the style in use: `I use your <name> style.`
   If it came from outside this project, print the path too. The user should
   never be shown a style whose origin they cannot see.
3. Then answer whatever the user asked. If they asked nothing, one line:
   `Go ahead.`

Do not explain what a profile is, what mode 2 does, or why the hook exists.

---

## Step 4 — Keep it for the rest of the session

After a `/compact` the SessionStart hook re-fires and restores the **default**
profile. A **named** profile is not restored. If the user switched to a named
one, re-apply it after a compaction and say so in one line.

---

## If the user runs this often

That is not mode 2 working. It means the automatic layer is missing or too
weak. Run `node <skill>/scripts/install.mjs --check`:

| Result | Say |
|---|---|
| `sessionStartHook: false` | *"Nothing reminds Claude of your style. Do you want me to install the hook?"* |
| hook on, drift inside long sessions | *"I can remind Claude in every message, not only at the session start. This uses more tokens. Do you want it?"* -> `--install --every-turn` |

Say it once, plainly. A user retyping `/speaksimple translate` every day
deserves to know there is a setting that stops that.

---

## Creating a named profile

When the user wants a second style — teaching, a client, one repo:

1. Copy the existing profile to `<skill folder>/profiles/<name>.md`.
2. Change only what differs. It is a variant, not a rewrite.
3. Keep the `<!-- SPEAKSIMPLE:BEGIN -->` markers, or it can never become the
   default later.
4. Output one line: `I saved the style. To use it, type: /speaksimple translate <name>`
