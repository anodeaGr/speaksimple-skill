# Calibration samples

Option sets for the mode 1 interview, used as the `preview` text of
`AskUserQuestion` options so the user compares real answers instead of
describing preferences in the abstract.

## Coverage, and why it is split across sets

`AskUserQuestion` allows at most 4 options per question. There are ten
frameworks. One picker therefore cannot show them all, and an earlier version
did not try: it showed the same four every time, so six frameworks were never
reachable no matter what the user wanted.

The sets below spread the ten across the interview:

| Set | When | Frameworks shown |
|---|---|---|
| 1 | Always | Unstyled default, ISO 24495-1, Easy Read, Information Mapping |
| 2 | Always | Google Developer, Microsoft, DITA task, ASD-STE100 |
| 3 | On request, or when sets 1 and 2 disagree | Mayer, Caterpillar, Attempto, keep previous pick |

Always tell the user after set 2 that more styles exist: *"I can show you four
more styles if none of these fit."* Without that line the interview silently
caps their choices at eight.

## Two rules for every sample

**Option A in set 1 is the genuine unstyled default.** Not a parody. Some
people read the long version and pick it, and that is a real finding. Rigging
the comparison so plain language always wins produces a profile that fights
the user rather than serving them.

**Every option contains the same facts.** The differences are packaging only.
If the short options quietly drop the caveat, the interview is measuring "do
you like being under-informed", which is not the question.

---

## Set 1 — explaining a concept

Ask: *"Same explanation, four ways. Which do you want when you are learning
something new?"*

### A — Full detail (the current default)

> An API key is a credential that identifies your application to a service.
> The reason it shouldn't be committed to source code is that repositories are
> frequently more public than people assume — they get forked, shared with
> contractors, pushed to a mirror, or made public years later — and once a key
> is in git history it stays there even after you delete the line, because git
> retains every prior commit. Scanners actively crawl public repositories for
> these patterns, and a leaked key can be used until it's revoked, which is
> often long after the fact. The conventional approach is to load keys from
> environment variables or a secrets manager, keeping the value outside the
> code entirely.

### B — Plain language (ISO 24495-1)

> An API key is a password for a service. Never put it in your code.
>
> Code gets shared, forked and made public more often than people expect. And
> git keeps deleted lines in its history, so removing the key later does not
> remove it. Bots scan public repositories for keys and find them fast.
>
> Keep the key in an environment variable instead.

### C — Easy Read

> An API key is like a password.
>
> It lets your app use a service.
>
> **Never put it in your code.**
>
> Code gets shared with other people. Git remembers old lines, even after you
> delete them. Robots search the internet for keys. They find them fast.
>
> **What to do:** put the key in an environment variable.

### D — Labelled blocks (Information Mapping)

> **What it is** — A password that identifies your app to a service.
> **The risk** — Code gets shared. Git keeps deleted lines forever. Bots scan
> public repos for keys and find them within minutes.
> **The rule** — Never in code.
> **Instead** — Load it from an environment variable.

---

## Set 2 — answering a decision question

Ask with content of a different shape: *"Now a decision question. Which shape
do you want here?"*

The comparison between sets 1 and 2 is the most valuable thing in the
interview. A different pick means the profile needs per-task-type rules, which
is usually closer to the truth: people want teaching when learning and a
verdict when working.

### A — Fluent and trimmed (Google Developer Style)

> Use the store. Local state is simpler right now, but the settings panel on
> your roadmap reads the same flag, and lifting state later is a bigger change
> than adding the store today.

### B — Answer first, then why (Microsoft Writing Style)

> **Use the store.**
>
> Local state is simpler today, but your settings panel will need the same
> flag. Moving it later costs you more than adding it now.

### C — Decision, then the steps (DITA)

> **Recommendation** — Use the store.
>
> **Why** — The settings panel will read the same flag.
>
> **To do it**
> 1. Add the flag to the store.
> 2. Read it in this component.
> 3. Delete the local state.
>
> **When local state wins instead** — Nothing else will ever read this flag.

### D — Minimal (ASD-STE100)

> Use the store. The settings panel needs the same flag. Local state is more
> work later.

---

## Set 3 — the remaining styles

Show this only when the user asks for more, or when sets 1 and 2 disagree and
neither pick feels right to them.

Same content as set 1, so they can compare against a judgement they already
made.

Ask: *"Four more styles, same explanation. Does one of these fit better?"*

### A — Words plus a picture (Mayer)

> ```
> your code  ──▶  git history  ──▶  public repo  ──▶  🤖 scanner
>   key here       key still here      key visible      key stolen
> ```
>
> Deleting the line does not remove it from git history. Keep the key in an
> environment variable so it never enters this chain.

### B — Controlled vocabulary (Caterpillar Technical English)

> An API KEY is a PASSWORD for a SERVICE. Do not put the API KEY in the CODE.
> Other people can read the CODE. GIT keeps the old LINES. Programs search for
> API KEYS in public CODE. Put the API KEY in an ENVIRONMENT VARIABLE.

### C — Zero ambiguity (Attempto Controlled English)

> An API key is a credential. A credential identifies an application. If a
> developer commits a credential to a repository, then the credential enters
> the history of the repository. If a credential enters the history, then a
> deletion of the line does not remove the credential. Therefore a developer
> stores a credential in an environment variable.

### D — Keep my earlier pick

> No preview. The user is saying the earlier choice was right.

---

## Generating your own set

Prefer these — a fixed set makes answers comparable between people and over
time. Write a custom set when the user's work is far from software, or when
they ask to see their own kind of content.

If you do, keep both rules at the top of this file, keep option A honestly
long, and keep every option factually identical.
