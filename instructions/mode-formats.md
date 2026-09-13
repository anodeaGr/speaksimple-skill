# Formats mode — show one answer in every style

`/speaksimple formats`, or any request like *"show me that answer in the other
formats"*, *"what would this look like in all the styles"*.

Writes nothing. Re-renders one piece of content in the named frameworks so the
user can see the difference on their own material.

## Why this exists

The interview shows four options at a time, because `AskUserQuestion` allows
four. A user who asks to see "all the formats" is asking for the ten
frameworks, not the four they were shown. Returning three was not a small
miss — it silently redefined "all" as "the ones I happened to offer".

## Steps

**1. Find the content.**

The user's last substantive answer, unless they name something else. If it is
ambiguous, ask which one in a single line, then stop.

**2. Load the definitions.**

Read [../references/frameworks.md](../references/frameworks.md), section
*"What each does to a sentence"*. All ten are rendered there on one shared
example. Use those as the specification for each style — not your own
impression of what the name suggests.

**3. Render.**

Default is all ten. `/speaksimple formats 4` renders the four most different
ones: ISO 24495-1, Easy Read, Information Mapping, ASD-STE100.

Order them from longest to shortest, so the compression is visible as the
reader scrolls:

1. Unstyled default (what they would normally get)
2. Google Developer Style
3. Microsoft Writing Style
4. ISO 24495-1 Plain Language
5. DITA information typing
6. Information Mapping
7. Easy Read
8. Caterpillar Technical English
9. ASD-STE100
10. Attempto Controlled English
11. Mayer — **only if the content has something worth drawing.** Say "not
    applicable here" rather than inventing a diagram. Mayer governs how words
    and a picture divide one message; with no picture there is nothing to
    govern.

Each one gets a heading with the framework name and a four-to-eight word note
on what it controls. Nothing else between them.

**4. Keep the facts identical.**

Same claims, same caveats, in every version. The user is comparing packaging.
If the short versions quietly drop a condition, they are comparing content and
the exercise is worthless.

This is the rule most easily broken under compression. Before you finish,
check the shortest version against the longest: if the short one is missing a
fact rather than a phrase, rewrite it.

**5. Close with one line.**

`Say the number to make that your style.` If they do, go to
[mode-1-learn.md](mode-1-learn.md) step 5 with that framework as the base —
they have already done the calibration by choosing.

## Output budget

This mode is the exception to the 10-line limit: the renderings are the
output. Your own words around them stay at one line each.
