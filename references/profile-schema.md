# Profile schema

The shape of `UserCommunicationProfile.md`. Start from
[../assets/UserCommunicationProfile.template.md](../assets/UserCommunicationProfile.template.md).

Location: `<skill folder>/UserCommunicationProfile.md` - inside the skill
folder, beside `SKILL.md`.

The skill's install location decides the scope, so the style file needs no
scope of its own:

| Skill installed at | Style applies to |
|---|---|
| `~/.claude/skills/speaksimple/` | every project |
| `<project>/.claude/skills/speaksimple/` | that project only |

Named alternates live in `<skill folder>/profiles/<name>.md`; mode 2 loads
those when given an argument. They are in a subfolder rather than loose beside
`SKILL.md` so that deleting user data can never touch skill code.

## The one hard requirement

The file **must** contain a block fenced by these exact markers:

```
<!-- SPEAKSIMPLE:BEGIN -->
...rules...
<!-- SPEAKSIMPLE:END -->
```

Both `scripts/speaksimple-context.mjs` and `scripts/install.mjs` read this
block by string match. Everything outside it is for humans and for mode 3.
Change the markers and the whole chain silently stops working — silently,
because the hook is built to fail quietly rather than break sessions.

## Sections, in order

### 1. The marked block — the only part Claude usually sees

Everything else in the file is reference material. This block is what gets
injected on every session start, so it carries the entire practical weight.

Constraints, and each one has a reason:

- **Under about 1,200 characters.** It is re-injected on every session start,
  and if `--every-turn` is on, every single turn. Long instructions also
  compete with the user's actual request for attention.
- **Imperative rules, not description.** "Answer first, then why" works.
  "The user prefers concision" does not — it describes a person instead of
  telling the reader what to do.
- **Specific enough to check.** "Be concise" is unfalsifiable. "Under 8 lines
  unless I ask for more" can be complied with or not.
- **Include the escape hatch.** Every profile needs a line like *"When I ask
  for detail, give it — these limits are defaults, not a ceiling."* Without
  it, profiles decay into answers too thin to use, and the user rarely
  complains in words that mode 3 can detect. They just stop asking.

### 2. Base framework and why

One named framework from [frameworks.md](frameworks.md), one or two sentences
of reasoning. The reasoning matters more than the name: it is what lets a
future re-align tell an outdated choice from a still-valid one.

### 3. Per task type

Only when `recommend.mjs` reports entries in `perTaskRulesNeeded`. That field
exists so this section is written from a number rather than an impression: a
task appears there when its best framework beats the overall base by at least
4 points for that task. Use the same buckets `analyze-sessions.mjs` reports, so mode 3's
findings map onto the profile without translation: `quick_qa`, `explain`,
`build`, `debug`, `plan`.

Omit this section rather than padding it. Three real rules beat five invented
ones, and an invented rule will be enforced just as literally as a real one.

### 4. Banned

Short list. Only things the user actually named.

### 5. Evidence

The interview answers, dated. This is what makes the profile maintainable
rather than magic: a year later, someone can see that "no tables" came from a
direct request and not from a guess. Mode 3 appends its findings here too.

### 6. Changelog

One line per revision: date, what changed, what justified it. Mode 3 writes
these. A profile that changes with no recorded reason cannot be reviewed, and
an unreviewable profile eventually gets deleted.

## Writing the block well

Bad:

```
The user prefers shorter, clearer responses and generally dislikes
excessive detail. Try to be concise and use simple language where possible.
```

Nothing there can be complied with or violated. "Where possible" and
"generally" make it advice, and advice loses to the model's defaults.

Good:

```
- Answer in the first line. Reasoning after, if it changes what I'd do.
- Under 8 lines unless I ask for more.
- Plain words. No idioms - English is my second language.
- No emoji. No "Great question". No apologies.
- Code: give the command or diff first, explain under it.
- When I say "explain" or "why", the limits above are off. Teach me properly.
```

Every line is checkable, and the last one keeps the profile from starving the
answers.
