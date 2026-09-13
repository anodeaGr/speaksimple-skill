# The interview

Five steps, roughly five minutes. Three of them are picks rather than
questions, because people cannot reliably describe how they want to be written
to but can recognise it instantly.

Use `AskUserQuestion` throughout. Put the sample text in each option's
`preview` field — that is what it is for, and it means the user compares real
answers side by side rather than reading labels.

Do not ask everything at once, and do not turn this into a form. If an answer
already tells you the next thing, skip ahead.

## Tool limits — read before the first call

`AskUserQuestion` accepts **2 to 4 options per question** and at most **4
questions per call**. A fifth option is a hard validation failure, not a
warning: the call is rejected with `Invalid tool parameters` and the user
watches an error go by. An earlier version of this file listed six banned-items
options and hit exactly that.

So: never list more than four. "Other" is added automatically, and it is where
anything you left out belongs. If four genuinely is not enough, ask a plain
text question instead of splitting into two pickers — two consecutive
near-identical questions feel like a broken form.

---

## Step 1 — Context

One `AskUserQuestion` call, three questions together.

**Q1. "What do you mostly use Claude for?"** (multiSelect)
- Writing and changing code
- Understanding code or systems someone else built
- Planning, deciding, thinking out loud
- Writing documents, courses, or presentations

**Q2. "Is English your first language?"**
- Yes
- No — I read it well, but plain words help
- No — keep the vocabulary simple

*Why this is asked:* it is the single strongest input. A "no" pushes the base
towards ISO 24495-1 plus ASD-STE100 vocabulary discipline — one word per
meaning, no idioms, no phrasal verbs where a plain verb exists. Idioms are the
part that hurts, and native speakers do not notice they are using them.

**Q3. "When Claude answers you, what happens most often?"**
- I read all of it
- I skim for the part I need
- I read the first lines, then decide whether to continue
- I copy the code or command and move on

*Why:* a skimmer needs headings and labels — Information Mapping. Someone who
reads the first lines needs the answer in the first lines. Someone who copies
the command wants it first and unwrapped.

**Q3 must produce a rule**, and it is the one most easily lost. It is the only
question about *shape*; every other question is about length or wording, so
nothing else will cover it. In a real run this answer was recorded in the
Evidence section and then silently dropped from the rules, which left the
profile with nothing to say about structure at all.

Map it directly:

| Answer | Rule to write |
|---|---|
| I read all of it | No structure rule needed. Say so rather than inventing one. |
| I skim for the part I need | "Use a bold label or heading per point so I can find the one I need without reading the rest." |
| I read the first lines, then decide | "Put the conclusion in the first two lines. Everything after that is optional reading." |
| I copy the code and move on | "Command or code block first, at the top, with nothing above it." |

---

## Step 2 — Calibration A, a concept

Load [calibration-samples.md](calibration-samples.md), Set 1.

Ask: *"Same explanation, four ways. Which do you want when you're learning
something new?"* Options A-D, each with the sample as `preview`.

Set 1 covers the unstyled default, ISO 24495-1, Easy Read and Information
Mapping. Set 2 covers four different frameworks, and Set 3 holds the rest.
Four options is the tool's hard limit, so the ten are spread across the sets
rather than shown at once.

If they choose A, take it at face value. Some people genuinely want the long
version, and a skill that refuses to hear that is not listening. Their profile
becomes about structure and ordering rather than compression.

---

## Step 3 — Calibration B, a decision

Set 2 from the same file. Ask: *"Now a decision question. Which shape here?"*

The comparison between steps 2 and 3 is the most valuable thing in the whole
interview. A different pick means the profile needs per-task-type rules rather
than one global style, which is usually closer to the truth: people want
teaching when learning and a verdict when working.

If the picks match, say so and move on. One rule is better than two when one is
accurate.

**Then offer the rest, in one line:** *"I can show you four more styles if none
of these fit."* On yes, show Set 3. Without this line the interview silently
caps the user's choice at eight of the ten frameworks, and they never learn the
others existed.

---

## Step 4 — The dials

One `AskUserQuestion` call, two questions.

**Q4. "How much reasoning do you want with an answer?"**
- The answer only. I'll ask why if I care.
- The answer, then one or two lines of why.
- The reasoning matters as much as the answer.
- Depends — short for quick things, full for decisions.

**Q5. "Anything you want banned?"** (multiSelect, exactly these four)
- Long preambles ("Great question! Let me explain…")
- Hedging ("it depends", "you may want to consider")
- Emoji
- Tables

Four, because that is the limit. These four are the ones people actually name;
anything else arrives through "Other" or through step 5.

Offer only what you will enforce. A banned list re-injected into every future
session should be short and real.

---

## Step 5 — The open one

Ask in plain text, not a picker:

> *"Last one. What annoys you most about how Claude answers you right now?"*

This is where the specific, unguessable thing arrives — "you repeat my question
back to me", "you write five options when I want one", "you apologise". Those
lines go into the profile close to verbatim, because they are already precise
and the user's own wording carries more weight than a paraphrase.

Accept a blank answer and move on.

---

## Before proposing: account for every answer

Walk the five steps and check each answer either became a rule or was
deliberately dropped. Say which, out loud, in one line each. This takes ten
seconds and catches the failure that actually happened in testing — an answer
politely recorded in the Evidence section and then forgotten by the rules.

| Answer | Should show up as |
|---|---|
| Q1 main uses | Usually nothing directly. Informs the framework choice. |
| Q2 first language | A vocabulary rule, if not English |
| Q3 reading behaviour | A structure rule — see the table above |
| Q2/Q3 calibration picks | The overall shape, and whether per-task-type rules exist |
| Q4 reasoning wanted | A rule about how much "why" to include |
| Q5 banned | The Never line |
| Step 5 verbatim | One rule in their own words, and the quote in Evidence |

Do not pad. "Q1 informs the framework, no separate rule" is a complete and
correct answer.

## Then: propose, do not save

1. Run `../scripts/recommend.mjs` with the answers as JSON. It scores all ten
   frameworks, overall and per task type, and says whether a second profile is
   worth it. See [../instructions/mode-1-learn.md](../instructions/mode-1-learn.md)
   step 3 for the exact call and how to read the output.

   Do not choose by hand. The user saw at most eight of the ten styles, and
   their answers carry evidence about all ten - the best base is regularly one
   they were never shown.
2. **Demonstrate before describing.** Take the user's own step 5 complaint,
   or their last real question in this session, and answer it in the proposed
   style. One concrete paragraph beats a page about principles.
3. Show the short rules block that will go into `CLAUDE.md` — the actual text,
   not a summary of it.
4. Ask: *"Does this sound like what you want? I can adjust before saving."*
5. Only then write the files and run setup: [../instructions/setup.md](../instructions/setup.md).

Write the profile to the schema in
[../references/profile-schema.md](../references/profile-schema.md), starting
from [../assets/UserCommunicationProfile.template.md](../assets/UserCommunicationProfile.template.md).
