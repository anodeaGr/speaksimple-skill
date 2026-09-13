# Off mode — turn the style off

Three different things, and picking the wrong one is the main failure here.

| The user types | Means | You do |
|---|---|---|
| `/speaksimple --off` | This one answer only | Ignore the rules for this answer. Write nothing to disk. |
| `/speaksimple off` | Until I turn it on | Run `install.mjs --disable` |
| `/speaksimple on` | Turn it back on | Run `install.mjs --enable` |

If the argument is ambiguous, ask in one line: *"For this answer only, or until
you turn it back on?"* Then stop.

---

## `--off` — one answer

**1. Answer without the style.** Full detail, normal structure, whatever the
question actually needs. The style rules do not apply to this answer.

**2. If the user included a question**, answer it. `/speaksimple --off explain
the build cache in full` means: explain it, in full, in your default voice.

**3. If there is no question**, say one line and stop:
`Style off for your next message. Ask away.`
Then apply the exemption to their next message, and only that one.

**4. Say nothing else about SpeakSimple.** No explanation of how the override
works, no reminder that the style exists. The user asked for their normal
answer, not a status report about why they can have one.

**5. Return to the style automatically** on the message after. Do not ask
whether they want it back. `--off` means one answer; if they wanted more they
would have said `off`.

### Be accurate about what this does

The rules were injected when the session started. They are already in context
and cannot be unsent. `--off` is you choosing to ignore them for one answer,
not the hook being prevented from running.

That distinction matters when the user asks why it did not fully work. The
honest answer is that an instruction competes with other instructions, and a
direct request in the current message is the strongest signal available but
not a switch in the wiring. If they need a guarantee, they need `off`.

---

## `off` — until turned back on

**1. Run:** `node <skill>/scripts/install.mjs --disable`

**2. Print the result in two lines:**

```
Style off. Your style file and the hook are untouched.
Turn it back on with: /speaksimple on
```

**3. Ignore the rules for the rest of this session too.** The flag stops the
hook from sending anything *next* time. The text from this session's start is
still in context, so keep ignoring it yourself until the session ends.

### Why a flag file and not removing the hook

Removing the hook and re-adding it later is more moving parts and more risk to
a file the user cares about. The flag is one file, and deleting it is the whole
undo.

It also keeps two states distinguishable. `--check` can report
`sessionStartHook: true, disabled: true` — installed but off. Without the flag
that state would look identical to "never installed", and the user would be
sent back through a five-minute interview they had already done.

---

## `on` — turn it back on

**1. Run:** `node <skill>/scripts/install.mjs --enable`

**2. Read the style file and start following it now**, in this session. Do not
wait for a restart. The hook fires at session start and cannot be triggered
mid-session, so "on" would otherwise change nothing the user can see.

**3. Two lines:**

```
Style on again. I use it from now on.
Restart Claude Code when you can, so it loads by itself in new sessions.
```

Say it in that order: what is true now, then what the restart buys. The old
wording led with the restart, which read as "nothing works yet" and sent one
user looking for a workaround.

---

## Checking

`/speaksimple check` reports `disabled` separately from `sessionStartHook`, so
"installed but off" never gets confused with "not installed".
