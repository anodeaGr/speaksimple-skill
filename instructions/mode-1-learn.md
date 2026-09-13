# Mode 1 — learn the user

`/speaksimple learn`

Numbered steps. Run them in order. Each one says what to output and when to
stop. Reasoning lives in [../references/](../references/) — do not restate it
to the user.

**Budget: your messages in this mode are at most 10 lines each.** The
interview is the user talking, not you. If you are writing paragraphs about
plain language, the skill has already failed.

---

## Step 1 — Read state

Run: `node <skill>/scripts/install.mjs --check`

`profile.path` is inside the skill folder. A freshly installed skill has no
style file, so the interview always starts from nothing.

Branch on the JSON. Exactly one applies:

| State | Do |
|---|---|
| `profile.exists: false` | **Go straight to step 2. The interview is mandatory.** Print `help.mjs --starting-interview` verbatim, then ask question 1 in the same message. |
| `profile.exists: true`, `sessionStartHook: false` | Ask: *"A style is saved. Do you want to keep it, or answer the questions again?"* Keep -> step 7. Answer again -> step 2. |
| `profile.exists: true`, `sessionStartHook: true` | Ask: *"The setup is complete. Do you want to change your style?"* Yes -> step 2, and keep the existing Evidence and Changelog. No -> stop. |

**When there is no style file, there is no question to ask and no shortcut to
offer.** Do not look for a style in another project. Do not offer to copy one.
Do not mention that one might exist elsewhere. Start the interview.

The style file is written at the END of the interview, in step 6, and never
before. Nothing on disk changes until the user approves the rules in step 5.

Output for this step: one question, or nothing at all. No status report — the
user just read it in help.

**STOP** only if you asked a question.

---

## Step 2 — Interview

Follow [../prompts/interview.md](../prompts/interview.md) exactly. Five steps.

Your own output between questions: at most one line. Do not explain what each
question is for.

---

## Step 3 — Score the frameworks, do not guess

Collect the answers into JSON and run the recommender:

```
node <skill>/scripts/recommend.mjs --answers '{"language":"…","reading":"…","reasoning":"…","uses":[…],"calibration1":"B","calibration2":"C","banned":[…]}'
```

Key names and allowed values are in the script's header comment. Leave out
anything the user did not answer. Never invent a value — an omitted signal
scores nothing, a wrong one scores against them.

**Do not pick a framework yourself.** The interview shows four options at a
time but the answers carry evidence about all ten, so the right base is often
one the user was never shown. A model weighing that by eye gives a different
answer each run and leaves nothing to audit.

Read these four fields:

| Field | Use it for |
|---|---|
| `primary` | The base you propose |
| `confidence` | `draw` → show the tied options and ask. `low` → you skipped questions; go back. |
| `perTaskRulesNeeded` | One per-task rule in the profile for each entry |
| `secondProfileSuggested` | `yes` → offer a second named profile, do not create it unasked |

**Output, four lines maximum:**

```
Base: <name> (<pct>%). <reason in under 12 words>.
Also close: <runner-up> (<pct>%).
Different for <task>: <name>. I add one rule for that.
```

Drop any line that does not apply. Add `--explain` and show the three scoring
signals only if the user asks why.

On `confidence: draw`, do not present a winner. Name the tied frameworks, say
they scored level, and ask the user to choose.

---

## Step 4 — Demonstrate

Take the user's step-5 complaint, or their last real question in this session.
Answer it in the proposed style.

Output: the demonstration only. Put one line before it:
`I answer your question again. This is the new style:`

---

## Step 5 — Show the rules and ask

Output, in this order, nothing else:

1. One line: `These are the rules. I save them if you approve.`
2. The rules block, in a code fence.
3. One line: `Do you approve these rules? I can change them first.`

**STOP.** Wait for a yes.

---

## Step 6 — Write the profile

Write to the `profile.path` reported by `--check`. That is always
`<skill folder>/UserCommunicationProfile.md` - the style lives beside the
skill that owns it. Use
[../assets/UserCommunicationProfile.template.md](../assets/UserCommunicationProfile.template.md)
and the schema in
[../references/profile-schema.md](../references/profile-schema.md).

Output: nothing. Go straight to step 7 in the same turn.

---

## Step 7 — Install

Run both, in this order, in the same turn:

1. `node <skill>/scripts/install.mjs --install`
2. `node <skill>/scripts/install.mjs --check`

`--install` never moves the skill. Moving it would change which projects the
style applies to. If `--check` reports `installedAs: unmanaged`, the skill is
not installed anywhere yet: ask the user whether this style is for **this
project** or **all projects**, then run `install.mjs --to project` or
`--to global`, and continue from the copy it made. A user who has the `skills`
CLI can run `npx skills add anodeaGr/speaksimple` instead and answer the same
question there; either way the folder it lands in is the scope.

**`--check` must print `ready: true`.** If it prints `false`, say what is
false and fix it. Never report success on a `false`.

Do not stop after the user's yes without running these. That happened on the
first real run: the profile was written, the hook never was, and the user was
left believing they were set up.

---

## Step 8 — Apply the style, then hand over

**Start following the rules now, in this session.** You wrote the profile in
step 6; read its marked block and obey it from your next sentence onward.

The hook only fires when a session *starts*. It has not run in this one and
cannot be made to. So without this step the user finishes a five-minute
interview, is told the setup is complete, and then watches the next answer come
back in the old style. That happened in a real session: the user ran
`/speaksimple off` and `/speaksimple on` to force it, and the style appeared —
not because the hook fired, but because running the command put the rules back
into context. They had to invent a workaround for a step the skill should have
done itself.

Then run: `node <skill>/scripts/help.mjs --after-install`

Print the output verbatim. Add nothing before it. Add nothing after it.

The text is generated, not written by you, for two reasons. It must be
identical every time. And it reads the real state first, so it cannot announce
success after a failed install.

**STOP.** The mode is over. Do not summarise it.
