#!/usr/bin/env node
/**
 * SpeakSimple framework recommender.
 *
 * Turns interview answers into a scored ranking of the ten frameworks, overall
 * and per task type, and says whether the user needs more than one style.
 *
 * Why this is a script and not a judgement call:
 *
 * 1. The interview can only ever SHOW four options at a time, but the answers
 *    carry evidence about all ten. A user who picks "plain language" while
 *    also saying they skim and copy commands has given three signals, and the
 *    right base may be one they were never shown. Asking a model to weigh that
 *    produces a different answer each run and no way to audit it.
 *
 * 2. The user asked for probabilities rather than a single winner, because a
 *    person is rarely one style. Scores make "70% Information Mapping, 20%
 *    ISO" expressible, and make the second-profile decision a number instead
 *    of a feeling.
 *
 * 3. Per task type is the whole point. The same person wants a bare verdict on
 *    a quick question and a real explanation when learning. One winner cannot
 *    say that; a score per task can.
 *
 * The matrix below is the skill's actual opinion about these frameworks. It is
 * meant to be argued with and edited - every weight has a one-line reason.
 *
 * Usage:
 *   node recommend.mjs --answers '{"language":"non_native_plain","reading":"skim"}'
 *   node recommend.mjs --answers-file answers.json
 *   node recommend.mjs --explain          include the reasoning per framework
 *
 * Answer keys (all optional; unknown values are ignored, not guessed):
 *   language      native | non_native_plain | non_native_simple
 *   reading       read_all | skim | first_lines | copy_code
 *   reasoning     answer_only | answer_then_why | full_reasoning | depends
 *   uses          array of: code | understand | plan | docs
 *   calibration1  A | B | C | D     (concept set: default/ISO/EasyRead/InfoMapping)
 *   calibration2  A | B | C | D     (decision set: Google/Microsoft/DITA/STE)
 *   calibration3  A | B | C         (extra set: Mayer/Caterpillar/Attempto)
 *   banned        array of: tables | hedging | preambles | emoji
 */

import { readFileSync } from "node:fs";

const FRAMEWORKS = {
  iso: "ISO 24495-1 Plain Language",
  ste: "ASD-STE100",
  easy_read: "Easy Read",
  info_mapping: "Information Mapping",
  dita: "DITA information typing",
  google: "Google Developer Style",
  microsoft: "Microsoft Writing Style",
  caterpillar: "Caterpillar Technical English",
  ace: "Attempto Controlled English",
  mayer: "Mayer multimedia principles",
};

const TASKS = ["quick_qa", "explain", "build", "debug", "plan"];

/**
 * Signal weights. Each entry is [framework, points, reason].
 *
 * A calibration pick is worth 6 because it is direct evidence: the user read
 * that style and chose it. Everything else is inference and worth less. Nothing
 * scores above 6, so no single answer can railroad the result.
 */
const WEIGHTS = {
  "language:native": [
    ["google", 3, "fluent reader, wants trimmed not simplified"],
    ["microsoft", 3, "same, slightly warmer"],
    ["iso", 2, "still a safe base"],
    ["ste", -1, "mechanical tone buys nothing here"],
    ["caterpillar", -2, "translation discipline is wasted"],
    ["ace", -2, "far too rigid for a fluent reader"],
  ],
  "language:non_native_plain": [
    ["iso", 4, "the standard answer for second-language readers"],
    ["ste", 2, "vocabulary discipline helps, tone may be too blunt"],
    ["easy_read", 1, "may be simpler than needed"],
    ["caterpillar", 1, "controlled vocabulary helps"],
    ["google", 1, "clear, but idioms slip in"],
    ["microsoft", 1, "same"],
    ["ace", -1, "unnatural to read"],
  ],
  "language:non_native_simple": [
    ["easy_read", 4, "explicitly built for hard-to-read audiences"],
    ["ste", 3, "one word per meaning, no idioms"],
    ["caterpillar", 3, "same discipline, translation-tested"],
    ["iso", 3, "plain but natural"],
    ["google", -1, "assumes idiomatic fluency"],
    ["microsoft", -1, "contractions and idioms"],
  ],
  "reading:read_all": [
    ["iso", 2, "prose is fine for a full reader"],
    ["google", 2, "same"],
    ["microsoft", 2, "same"],
    ["info_mapping", -1, "labels add friction for a linear reader"],
  ],
  "reading:skim": [
    ["info_mapping", 5, "labels and chunks exist for exactly this"],
    ["dita", 3, "typed sections are scannable"],
    ["easy_read", 1, "short blocks help"],
    ["google", -1, "flowing prose resists skimming"],
  ],
  "reading:first_lines": [
    ["microsoft", 3, "answer-first is its house style"],
    ["info_mapping", 2, "the label carries the answer"],
    ["google", 2, "front-loaded and trimmed"],
    ["ste", 2, "no build-up"],
    ["iso", 1, "usually front-loads"],
  ],
  "reading:copy_code": [
    ["ste", 3, "procedural and unadorned"],
    ["google", 2, "code-first conventions"],
    ["info_mapping", 1, "the command is easy to locate"],
    ["easy_read", -2, "narrative framing gets in the way"],
    ["ace", -1, "logical prose around code is noise"],
  ],
  "reasoning:answer_only": [
    ["ste", 3, "states, does not justify"],
    ["google", 2, "concise by default"],
    ["microsoft", 2, "answer-first"],
    ["dita", -1, "its structure implies more sections"],
    ["easy_read", -1, "explains by nature"],
  ],
  "reasoning:answer_then_why": [
    ["microsoft", 3, "verdict then one line of why"],
    ["google", 3, "same"],
    ["iso", 3, "natural fit"],
  ],
  "reasoning:full_reasoning": [
    ["iso", 3, "clear without being short"],
    ["dita", 2, "concept sections carry the why"],
    ["google", 1, "can expand"],
    ["ste", -2, "cannot hold an argument"],
    ["easy_read", -2, "strips the nuance"],
  ],
  "reasoning:depends": [
    ["dita", 3, "deciding the answer TYPE first is literally this"],
    ["iso", 1, "flexible base"],
  ],
  "uses:code": [
    ["google", 2, "written for developer docs"],
    ["ste", 1, "good for procedures"],
  ],
  "uses:understand": [
    ["iso", 2, "explanation is its purpose"],
    ["dita", 2, "separates what-it-is from how-to"],
    ["easy_read", 1, "helps with unfamiliar material"],
  ],
  "uses:plan": [
    ["microsoft", 2, "recommendation-shaped"],
    ["dita", 1, "concept vs task split helps decisions"],
    ["iso", 1, "neutral base"],
  ],
  "uses:docs": [
    ["mayer", 3, "slides and courses are its home ground"],
    ["info_mapping", 2, "built for structured documents"],
    ["easy_read", 1, "teaching material"],
  ],
  "calibration1:A": [
    ["google", 2, "chose the long version: wants completeness, not compression"],
    ["microsoft", 2, "same"],
    ["iso", 1, "still clearer than the default"],
    ["easy_read", -3, "explicitly did not choose the simplest option"],
    ["ste", -2, "same"],
  ],
  "calibration1:B": [["iso", 6, "chose plain language when shown it"]],
  "calibration1:C": [["easy_read", 6, "chose Easy Read when shown it"]],
  "calibration1:D": [["info_mapping", 6, "chose labelled blocks when shown them"]],
  "calibration2:A": [["google", 6, "chose fluent and trimmed"]],
  "calibration2:B": [["microsoft", 6, "chose answer-first with a short why"]],
  "calibration2:C": [["dita", 6, "chose decision plus explicit steps"]],
  "calibration2:D": [["ste", 6, "chose the minimal version"]],
  "calibration3:A": [["mayer", 6, "chose words paired with a diagram"]],
  "calibration3:B": [["caterpillar", 6, "chose controlled vocabulary"]],
  "calibration3:C": [["ace", 6, "chose zero ambiguity over readability"]],
  "banned:tables": [
    ["info_mapping", -3, "banned tables; its labelled grid is the point"],
    ["dita", -1, "leans on structured blocks"],
  ],
  "banned:hedging": [
    ["ste", 2, "cannot hedge"],
    ["microsoft", 1, "commits to a recommendation"],
    ["google", 1, "same"],
  ],
  "banned:emoji": [["easy_read", -1, "often uses icons and symbols"]],
  "banned:preambles": [],
};

/**
 * Task modifiers, applied on top of the base score.
 *
 * This is where "one style does not fit every job" becomes arithmetic. A
 * person who scores highest on Easy Read overall may still want ASD-STE100
 * for a quick yes/no, and these numbers are what surface that.
 */
const TASK_MODS = {
  quick_qa: { ste: 6, microsoft: 5, google: 4, iso: 1, easy_read: -2, info_mapping: -2, dita: -4, ace: -4, mayer: -6 },
  explain: { easy_read: 6, iso: 5, dita: 4, mayer: 4, info_mapping: 2, ste: -4, ace: -4 },
  build: { ste: 6, google: 6, dita: 4, info_mapping: 2, iso: 1, easy_read: -4, ace: -2, mayer: -4 },
  debug: { info_mapping: 6, ste: 4, google: 4, dita: 2, iso: 1, easy_read: -2, ace: -2, mayer: -2 },
  plan: { microsoft: 6, dita: 4, iso: 4, info_mapping: 4, ste: -2, ace: -2 },
};

/**
 * Task modifiers reach +/-6, the same magnitude as a calibration pick.
 *
 * They were half that at first and it made the whole per-task idea decorative:
 * a 9-point gap in the base score could not be closed by a 3-point nudge, so
 * the overall winner won every task and `perTaskRulesNeeded` was always empty.
 * A task's fit is direct evidence for that task, so it is weighted like one.
 */

// ------------------------------------------------------------------ scoring

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : d;
};

function loadAnswers() {
  const file = val("--answers-file", null);
  const inline = val("--answers", null);
  try {
    if (file) return JSON.parse(readFileSync(file, "utf8"));
    if (inline) return JSON.parse(inline);
  } catch (e) {
    console.error("Cannot read answers: " + e.message);
    process.exit(1);
  }
  console.error('Give --answers \'{"language":"...","reading":"..."}\' or --answers-file <path>.');
  process.exit(1);
}

/** Turn the answer object into the flat signal keys used by WEIGHTS. */
function signalsFrom(a) {
  const out = [];
  for (const k of ["language", "reading", "reasoning", "calibration1", "calibration2", "calibration3"]) {
    if (a[k]) out.push(`${k}:${a[k]}`);
  }
  for (const u of a.uses || []) out.push(`uses:${u}`);
  for (const b of a.banned || []) out.push(`banned:${b}`);
  return out.filter((s) => WEIGHTS[s]);
}

/**
 * Softmax, so the output reads as a share of belief rather than raw points.
 *
 * Temperature 4.5, not 2.2. At 2.2 a three-point gap printed as 76% against
 * 20%, and a framework scoring 7 out of a possible 16 printed as 1.3%. Those
 * numbers claim a confidence the evidence does not support, and a user shown
 * "76%" stops questioning the result. The flatter curve keeps the ordering and
 * stops the number from doing rhetorical work the data has not earned.
 */
function toPercent(scores, temperature = 4.5) {
  const keys = Object.keys(scores);
  const max = Math.max(...keys.map((k) => scores[k]));
  const exps = keys.map((k) => Math.exp((scores[k] - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  const out = {};
  keys.forEach((k, i) => (out[k] = +((exps[i] / sum) * 100).toFixed(1)));
  return out;
}

function rank(scores, pct, why) {
  return Object.keys(FRAMEWORKS)
    .map((k) => ({ id: k, name: FRAMEWORKS[k], score: +scores[k].toFixed(1), pct: pct[k], why: why ? why[k] : undefined }))
    .sort((a, b) => b.pct - a.pct);
}

function main() {
  const answers = loadAnswers();
  const signals = signalsFrom(answers);

  const base = Object.fromEntries(Object.keys(FRAMEWORKS).map((k) => [k, 0]));
  const why = Object.fromEntries(Object.keys(FRAMEWORKS).map((k) => [k, []]));
  const unknown = [];

  for (const [k, v] of Object.entries(answers)) {
    if (Array.isArray(v)) continue;
    if (["language", "reading", "reasoning", "calibration1", "calibration2", "calibration3"].includes(k) && !WEIGHTS[`${k}:${v}`]) {
      unknown.push(`${k}=${v}`);
    }
  }

  for (const s of signals) {
    for (const [fw, pts, reason] of WEIGHTS[s]) {
      base[fw] += pts;
      why[fw].push({ signal: s, points: pts, reason });
    }
  }
  for (const k of Object.keys(why)) {
    why[k].sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
    why[k] = why[k].slice(0, 3);
  }

  const overall = rank(base, toPercent(base), has("--explain") ? why : null);

  const byTask = {};
  for (const t of TASKS) {
    const s = { ...base };
    for (const [fw, m] of Object.entries(TASK_MODS[t] || {})) s[fw] += m;
    byTask[t] = rank(s, toPercent(s)).slice(0, 3);
  }

  // A second style is worth the user's time only when some task actually
  // disagrees with the overall winner by a visible margin. Below that, one
  // profile with a couple of per-task rules is simpler and just as accurate.
  const primary = overall[0];
  const diverging = TASKS.filter((t) => byTask[t][0].id !== primary.id)
    .map((t) => ({
      task: t,
      framework: byTask[t][0].name,
      id: byTask[t][0].id,
      margin: +(byTask[t][0].pct - (byTask[t].find((x) => x.id === primary.id)?.pct ?? 0)).toFixed(1),
    }))
    .filter((d) => d.margin >= 4);

  const spread = overall[0].pct - overall[1].pct;

  console.log(JSON.stringify({
    signalsUsed: signals,
    unknownAnswers: unknown,
    overall,
    primary: { id: primary.id, name: primary.name, pct: primary.pct },
    runnerUp: { id: overall[1].id, name: overall[1].name, pct: overall[1].pct },
    // A tie is not a "medium confidence" result, it is a genuine draw, and
    // presenting whichever one happened to sort first as "the recommendation"
    // would be a coin flip dressed as analysis. Say it is a draw and let the
    // user break it - they have just read both styles and can.
    tiedWith:
      spread <= 1.5
        ? overall.filter((f) => overall[0].pct - f.pct <= 1.5).map((f) => f.name)
        : null,
    confidence:
      signals.length < 4
        ? "low - too few answers, ask the rest of the interview before proposing"
        : spread <= 1.5
          ? "draw - two or more bases score level. Show them and ask the user to pick."
          : spread >= 8
            ? "high - one clear base"
            : "medium - two bases score close, mention both to the user",
    byTask,
    perTaskRulesNeeded: diverging,
    secondProfileSuggested:
      diverging.length >= 2 && diverging.some((d) => d.margin >= 10)
        ? "yes - at least two task types want a different base by a wide margin"
        : "no - one profile with per-task rules covers this",
    howToRead: {
      pct: "Share of belief across the ten frameworks, from a softmax over the raw scores. Not a probability of being correct.",
      use: "Propose `primary` as the base. Add a per-task rule for each entry in perTaskRulesNeeded. Show the user the top three and the numbers, so the choice is theirs to overrule.",
      audit: "Run with --explain to see the three strongest signals behind each framework's score.",
    },
  }, null, 2));
}

main();
