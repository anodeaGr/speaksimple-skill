# Mode 3 — re-align (meta-learning)

`/speaksimple re-align`

Checks whether the current style is working, using past sessions as evidence.
Produces `metalearning_<N>.md` and a proposed profile edit.

**Budget: the report is the output. Your chat messages are at most 8 lines.**
Do not narrate the analysis while doing it.

---

## Step 1 — Run the analyser

```
node <skill>/scripts/analyze-sessions.mjs --all --days 90 --out <tmp>/report.json --quiet
```

Flags: `--project .` for the current directory only, `--project <slug>` for one
project, `--days N`, `--exclude a,b` (defaults to skipping `SpeakSimple`;
naming `--project` overrides it).

Verified: 500 sessions, 3,304 human messages, 8.5 seconds.

---

## Step 2 — Read `howToRead` in the report

It is embedded in the output so the guard rails cannot be skipped.

---

## Step 3 — Check the sample size, and be willing to stop here

| `totals.styleRepairMessages` | Do |
|---|---|
| under 10 | Write the report, verdict = **not enough evidence**, propose nothing. Go to step 7. |
| 10–29 | Propose at most one change. Label it provisional. |
| 30+ | Propose per-task-type changes. |

Stopping is a real result. A profile edited monthly on thin evidence drifts
away from what the user wanted, and every single edit looks justified at the
time.

---

## Step 4 — Read the quotes, discard the false positives

Every example has a `matchedBy` field naming the pattern that fired. Read them.

The first version of these patterns was about 75% false positives — *"a simple
task"* counted as *asked for simpler language*, *"colaborate"* as *asked for
more detail*. Those two are fixed; the class of error is permanent, because
pattern matching over free text produces candidates, not facts.

Count what you discard. You will report that number.

---

## Step 5 — Read the three numbers

| Number | Means |
|---|---|
| `totals.styleRepairMessages` | Asked for a different **style**. The only number that may change the profile. |
| `totals.taskFrustrationMessages` | The **work** went wrong. Report it, never act on it. On the real corpus it outnumbered style complaints ~2.5:1. |
| `answerLength` | Complaint-median much higher than normal-median → length is the problem. Close together → it is vocabulary or structure, and cutting length will not help. Measured: 1,623 vs 2,043, so length was *not* the issue. |

Then `byTaskType`. Buckets are `quick_qa`, `explain`, `build`, `debug`, `plan`
— the same names the profile's per-task-type table uses, so a finding maps
straight onto an edit. Read rates next to counts: 97 messages and 0 repairs is
a result; 4 messages and 2 repairs is not.

---

## Step 6 — Write the report

Path: `<skill folder>/metalearning_<N>.md`, beside the style it reviews. N is
one above the highest existing (`ls <skill folder>/metalearning_*.md`).

```markdown
# Meta-learning report <N>
Date: YYYY-MM-DD
Window: <days> days, <sessions> sessions, <N> human messages
Profile reviewed: <path>

## Verdict
<One paragraph. "Not enough evidence" is legitimate and common.>

## Evidence
| Signal | Candidates | Kept | What they were |

## Answer length
Median before a style complaint: X. Before a normal turn: Y. Reading: ...

## By task type
| Task | Messages | Style repairs | Rate | Reading |

## Discarded
<The false positives you rejected, and why. This is what makes it auditable.>

## Proposed changes
<Numbered. Each names its evidence. "No change needed" is often correct.>

## Not addressed here
<Task frustration counts, flagged as out of scope.>
```

---

## Step 7 — Propose, do not apply

Output: the verdict in one line, the proposed diff to the profile's marked
block, and one line: `Do you approve this change?`

**STOP.** On yes:

1. Edit the profile.
2. Append the findings to its Evidence section, dated.
3. Add a Changelog row: what changed, what justified it.
4. Run `node <skill>/scripts/install.mjs --install` — the CLAUDE.md block is
   generated from the profile and goes stale otherwise.
5. Two lines: `I changed your style.` / `Close Claude Code. Then start it again.`
