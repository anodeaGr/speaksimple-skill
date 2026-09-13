# Communication frameworks

Read this when choosing or revising a profile's base style.

These are real, published standards, not vibes. Naming one in a profile buys
you something an instruction like "be clearer" cannot: a specific, testable set
of rules that another person — or a future model — can apply the same way.

## Contents

- [What each one controls](#what-each-one-controls)
- [Choosing a base](#choosing-a-base)
- [What each does to a sentence](#what-each-does-to-a-sentence)
- [Combining them](#combining-them)
- [Sources](#sources)

## What each one controls

| Framework | Controls | Resulting style | Best for |
|---|---|---|---|
| **ASD-STE100** | Vocabulary, grammar, sentence construction | Precise, short, unambiguous, slightly mechanical | Procedures, step-by-step technical instructions |
| **ISO 24495-1 Plain Language** | Clarity, relevance, findability, usability | Natural but very clear | General explanation. The safe default. |
| **Easy Read** | Words, sentence complexity, layout, images | Extremely simple and visual | Complete beginners; genuinely difficult ideas |
| **Information Mapping** | Chunking, labels, hierarchy, consistency | Modular, scan-friendly | Readers who scan rather than read |
| **DITA information typing** | Separates Concept / Task / Reference | Very structured | Answering "what is it?" vs "how do I do it?" vs lookup |
| **Google Developer Style** | Sentence structure, vocabulary, voice | Clear, modern, concise | Technical content without the robotic feel |
| **Microsoft Writing Style** | Terminology, clarity, voice | Natural, concise, user-focused | Same niche as Google, slightly warmer |
| **Caterpillar Technical English** | Controlled vocabulary and grammar | Close to ASD-STE100 | Consistency across translated documentation |
| **Attempto Controlled English** | Extremely controlled syntax and semantics | Almost formal logic | Zero ambiguity. Too rigid for explanation. |
| **Mayer's multimedia principles** | Cognitive load; words paired with visuals | Minimal, instructional, visual | Anything with diagrams, slides, or images |

## Choosing a base

Work down this list and stop at the first match. The point is to reach a
defensible choice quickly, not to survey the field.

1. **The reader is new to the subject and finds it genuinely hard** → Easy
   Read, with Mayer if there will be visuals.
2. **The reader scans and hunts for one fact** → Information Mapping. Labels
   and chunks matter more than sentence length here.
3. **The content is mostly procedures** → ASD-STE100. Its bluntness is a
   feature when someone is following steps with their hands busy.
4. **The reader is fluent and technical but wants less padding** → Google
   Developer Style.
5. **Reading in a second language** → ISO 24495-1, plus ASD-STE100's
   vocabulary discipline: one word for one meaning, no idioms, no phrasal
   verbs where a plain verb exists. This combination matters more than any
   single choice on this list.
6. **Anything else** → ISO 24495-1. It is an international plain-language
   standard and a sound default.

DITA is orthogonal to all of the above. It decides *what kind of answer* this
is before deciding how to word it, so it combines with any base. It earns its
place when someone keeps getting a concept explanation when they wanted steps.

Attempto and Caterpillar are listed for completeness. Attempto is too rigid
for conversation; Caterpillar overlaps almost entirely with ASD-STE100 and is
harder to source.

## What each does to a sentence

All ten treatments of the same fact, plus the unstyled default. This section
is the concrete difference; the table above is only the label for it.

It is also the source for `/speaksimple formats`, which re-renders an answer
in every style on demand. Keep all ten here and keep them factually identical,
or that command silently starts comparing content instead of style.

**Unstyled default:**

> The reason your change isn't appearing is likely that the built assets are
> being served from a cache — either the bundler's own on-disk cache or the
> browser's HTTP cache — so although the source file was updated, the artifact
> being delivered to the page hasn't been regenerated yet.

**ISO 24495-1 Plain Language** — natural, but every clause earns its place:

> Your change is not showing because the page is loading an old copy. The file
> was saved, but the built version was not rebuilt. Clear the cache and build
> again.

**ASD-STE100** — one idea per sentence, approved vocabulary, active voice:

> The browser shows an old file. The build did not make a new file. Do this:
> delete the cache. Then build again.

**Easy Read** — short lines, one idea each, plain words, room for a picture:

> Your new code is saved.
>
> But the page is showing the **old** code.
>
> This happens because the computer kept a copy to be fast.
>
> **What to do:** clear the cache, then build again.

**Information Mapping** — labelled blocks, built for scanning:

> **Symptom** — Change saved, page unchanged.
> **Cause** — The page is served from a cache, not from your new build.
> **Fix** — Clear the cache, then rebuild.
> **Check** — Hard-reload. If it still fails, the bundler cache is the culprit.

**Google Developer Style** — fluent and technical, just trimmed:

> The page is serving a cached build, so your source change hasn't been picked
> up. Clear the cache and rebuild.

**Microsoft Writing Style** — like Google, but warmer and more direct to the
reader; second person, contractions allowed:

> Your change isn't showing up because the page is loading a cached build.
> Clear the cache and rebuild, and you'll see it.

**DITA information typing** — decide the answer's *type* first, then write.
This is a Task, so it is written as one:

> **Task: make your change appear**
>
> *Before you start:* your source file is saved.
>
> 1. Clear the build cache.
> 2. Run the build again.
> 3. Hard-reload the page.
>
> *Result:* the page serves the new bundle.
>
> *Related concept:* the browser and the bundler each keep their own cache.

**Caterpillar Technical English** — controlled vocabulary, strict one-clause
sentences, consistent terms, built for translation:

> The BROWSER shows an OLD FILE. The BUILD did not make a NEW FILE.
> Delete the CACHE. Do the BUILD again.

**Attempto Controlled English** — every sentence maps to formal logic; no
ambiguity is possible, and no rhythm survives:

> The page loads a file. The file is a cached file. The build does not create
> a new file. If a developer deletes the cache and the developer runs the
> build, then the page loads a new file.

**Mayer** — only relevant when there is a visual; the rule is that words and
picture carry different halves of one message, never the same half twice:

> ```
> source.js  →  [build]  →  bundle.js  →  browser
>    ✅ new        ⛔ skipped     ❌ old
> ```
>
> The build step did not run. The browser is showing the old bundle.

Notice what changes and what does not. Every version says the same true thing.
None of them omit the cause. Plain language is not less information — it is the
same information with the packaging removed. A profile that produces confident
but hollow answers has misapplied all of this.

## Combining them

Real profiles are almost always one base plus borrowed rules. Useful pairings:

- **ISO base + Information Mapping headings** — readable prose that can also be
  scanned. The most broadly useful combination.
- **ISO base + ASD-STE100 vocabulary** — the second-language combination.
  Natural rhythm, disciplined word choice.
- **Any base + DITA typing** — decide concept / task / reference first, then
  write. Fixes the "I asked how, you told me what" failure.
- **Any base + Mayer** — applies only where a diagram or screenshot appears.

Avoid stacking three or more. Past two, the rules start contradicting each
other and the profile stops being usable.

## Sources

- ISO 24495-1:2023 Plain language — <https://www.iso.org/standard/78907.html>
- Easy Read Standard — <https://easyreadstandard.org/>
- Information Mapping — <https://www.sciencedirect.com/science/chapter/edited-volume/abs/pii/B9780122232602500141>
- DITA technical content — <https://docs.oasis-open.org/dita/v1.2/os/spec/langRef-technicalContent.html>
- Google developer documentation style guide — <https://developers.google.com/style/highlights>
- Microsoft Writing Style Guide — <https://github.com/MicrosoftDocs/microsoft-style-guide>
- Controlled natural languages survey (ASD-STE100, Caterpillar, ACE) — <https://doi.org/10.1162/COLI_A_00168>
- Attempto Controlled English — <https://doi.org/10.1007/978-3-540-85658-0_3>
- Mayer, multimedia learning — <https://onlinelibrary.wiley.com/doi/full/10.1111/jcal.12197>
