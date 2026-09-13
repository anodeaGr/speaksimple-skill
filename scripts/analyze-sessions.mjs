#!/usr/bin/env node
/**
 * SpeakSimple session analyser (mode 3: re-align).
 *
 * Mines past Claude Code transcripts for evidence about whether the current
 * communication style is actually working, and produces a JSON report for
 * Claude to turn into a metalearning_<N>.md artifact.
 *
 * Why a script instead of asking Claude to "read the sessions": a single
 * transcript file mixes human messages with tool results, hook injections,
 * command caveats and attachments. In a real file measured on this machine,
 * 47 lines had type "user" and exactly 2 of them were written by a person.
 * Reading raw transcripts would drown the signal in tool output and burn the
 * context window on noise. The script does the filtering and counting; Claude
 * does the judgement, which is the part it is good at.
 *
 * Usage:
 *   node analyze-sessions.mjs --all --days 90
 *   node analyze-sessions.mjs --project .            # current directory
 *   node analyze-sessions.mjs --project C--Anodea-Foo --out report.json
 *
 * Flags:
 *   --all                 every project (default if --project is absent)
 *   --project <slug|path|.>  one project; "." resolves the current directory
 *   --days <N>            only sessions modified in the last N days (default 90)
 *   --max-sessions <N>    safety cap on files read (default 500)
 *   --examples <N>        example quotes kept per signal (default 8)
 *   --out <file>          write JSON here as well as stdout
 *   --quiet               suppress the human-readable summary
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  // Test presence, not truthiness: `--exclude ""` is a deliberate "exclude
  // nothing" and must not silently fall back to the default exclusion.
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : d;
};

const DAYS = parseInt(val("--days", "90"), 10);
const MAX_SESSIONS = parseInt(val("--max-sessions", "500"), 10);
const N_EXAMPLES = parseInt(val("--examples", "8"), 10);
const OUT = val("--out", null);
const QUIET = has("--quiet");
// Comma-separated substrings of project slugs to skip. The default excludes
// the SpeakSimple project itself: sessions spent building this skill are full
// of the words it searches for ("simpler", "concise", "too long") and would
// otherwise show up as the user complaining about style.
const EXCLUDE = val("--exclude", "SpeakSimple")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const PROJECTS_ROOT = join(homedir(), ".claude", "projects");

// --------------------------------------------------------------- text utils

/**
 * Claude Code slugifies the working directory by replacing every character
 * that is not a letter or digit with a dash. Verified against real directory
 * names on disk, e.g.  C:\Anodea\_Anodea_Harness\docs
 *                   -> C--Anodea--Anodea-Harness-docs
 */
const slugify = (p) => String(p).replace(/[^a-zA-Z0-9]/g, "-");

const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3; // early out, we never need >2
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

/**
 * Fuzzy single-word match. This exists because the people most likely to need
 * a plain-language profile are often typing in a second language and at speed:
 * "eplain", "epxlain", "shortre", "concice". An exact-match detector scores
 * them as having no complaints at all, which is the opposite of the truth.
 *
 * The `avoid` list is not optional decoration. Edit distance cannot tell a
 * typo from a different real word: "simple" is one edit from "simpler", so
 * "a simple task" was being logged as "asked for simpler language", and
 * "colaborate" is two edits from "elaborate". On the first real run those two
 * collisions produced 54 of 68 style hits - the detector was measuring almost
 * nothing but its own noise. Every fuzzy word needs its known neighbours
 * listed here, and new false positives get added as they are found.
 */
function fuzzyHas(tokens, word, avoid) {
  const tol = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
  const blocked = new Set(avoid || []);
  return tokens.some((t) => {
    if (t === word) return true;
    if (tol === 0 || blocked.has(t)) return false;
    if (Math.abs(t.length - word.length) > tol) return false;
    return levenshtein(t, word) <= tol;
  });
}

/**
 * Strip everything that is technically in a "human" message but was not
 * written by the human: slash-command scaffolding, caveats, system reminders,
 * and pasted code. A slash command's body is the skill author's prose, and on
 * the first real run it was being counted as the user asking for concision,
 * because the skill text happens to contain the word "concise".
 */
function cleanUserText(raw) {
  let t = String(raw);
  const args = t.match(/<command-args>([\s\S]*?)<\/command-args>/);
  if (/<command-(message|name)>/.test(t)) t = args ? args[1] : "";
  t = t
    .replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/g, " ")
    .replace(/<local-command-[a-z-]+>[\s\S]*?<\/local-command-[a-z-]+>/g, " ")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")   // pasted code is not the user's voice
    .replace(/https?:\/\/\S+/g, " ");
  return t.trim();
}

// ----------------------------------------------------------------- signals

/**
 * Two families of signal, and keeping them apart is the whole point.
 *
 * STYLE signals are complaints about how Claude said something. They are the
 * only evidence that should ever change a communication profile.
 *
 * TASK signals are complaints about what Claude did - forgot a file, broke a
 * build, ran the wrong thing. On a first pass over 1,643 real messages these
 * outnumbered style complaints roughly 2:1, and folding them together would
 * have "proved" the writing style was failing when the actual failures were
 * about work, not words. Retuning prose because a script deleted the wrong
 * folder makes the profile worse, not better.
 *
 * `ask_more` is a deliberate counter-signal. A profile tuned only on "too
 * long" will keep compressing until answers stop being actionable, and nobody
 * writes a complaint titled "that was too terse to use" - they just quietly
 * re-ask.
 *
 * Patterns are matched on word boundaries against punctuation-stripped text.
 * Anything ambiguous between a style complaint and an ordinary task request
 * ("step by step", "in a list", "more information") is deliberately excluded:
 * a smaller honest count beats a large contaminated one, because the counts
 * are what a future profile edit gets justified with.
 */
const SIGNALS = {
  ask_simpler: {
    family: "style",
    label: "Asked for simpler language",
    phrases: [
      "in simple", "simple words", "simpler", "more simple", "in simple terms",
      "eli5", "explain like i", "plain english", "in plain", "make it simple",
      "i dont understand", "i do not understand", "i didnt understand",
      "i cant understand", "i can not understand", "what do you mean",
      "dumb it down", "layman", "too technical", "too complex", "hard to follow",
      "i am lost", "im lost", "confusing", "makes no sense",
    ],
    words: [
      { word: "simpler", avoid: ["simple", "simply", "sample", "samples", "simples", "sampler"] },
      { word: "simplify", avoid: ["simply", "simple", "amplify"] },
      { word: "eli5", avoid: [] },
    ],
  },
  ask_shorter: {
    family: "style",
    label: "Asked for shorter output",
    phrases: [
      "too long", "shorter", "be brief", "briefly", "tldr", "tl dr", "less text",
      "less words", "fewer words", "keep it short", "short answer", "too much text",
      "too many words", "stop writing so much", "get to the point", "no preamble",
      "just the answer", "in one line", "in two lines", "in three lines",
      "in 1 line", "in 2 lines", "in 3 lines", "max 3 lines", "in 5 lines",
      "shorten", "trim it",
    ],
    words: [
      { word: "shorter", avoid: ["short", "shorts", "shorted", "sorter", "sorted", "shooter"] },
      { word: "briefly", avoid: ["brief", "briefs", "briefing"] },
      { word: "concise", avoid: ["concise"] },
      { word: "tldr", avoid: [] },
      { word: "succinct", avoid: [] },
      { word: "shorten", avoid: ["short", "shorted", "shorten"] },
    ],
  },
  ask_repeat: {
    family: "style",
    label: "Had to ask again for the same thing",
    phrases: [
      "explain again", "say it again", "one more time", "re explain", "reexplain",
      "didnt get it", "did not get it", "still dont understand",
      "still do not understand", "again please", "i already said", "as i said before",
    ],
    words: [],
  },
  ask_format: {
    family: "style",
    label: "Asked for a different format",
    phrases: [
      "no bullet", "without bullet", "stop using bullet", "no emoji", "without emoji",
      "stop using emoji", "no markdown", "stop using tables", "use a table instead",
      "as a table instead", "fewer headers", "no headers", "stop using headers",
      "code only", "just the code", "only the code", "without explanation",
      "no explanation", "dont explain", "do not explain", "stop explaining",
    ],
    words: [],
  },
  style_complaint: {
    family: "style",
    label: "Explicit complaint about how Claude writes",
    phrases: [
      "your answers are", "your answer is too", "you write too much",
      "you always write", "you talk too much", "too verbose", "verbose",
      "wall of text", "who reads all", "i cant read all", "stop the essay",
      "your style",
    ],
    words: [],
  },
  ask_more: {
    family: "counter",
    label: "Asked for MORE detail (counter-signal)",
    phrases: [
      "more detail", "in more detail", "explain more", "elaborate", "go deeper",
      "more context", "tell me more", "full explanation", "be more specific",
      "why exactly", "expand on",
    ],
    words: [
      { word: "elaborate", avoid: ["collaborate", "colaborate", "collaborated", "colaborated", "collaborating", "colaborating", "laborate"] },
    ],
  },
  task_frustration: {
    family: "task",
    label: "Frustration about the work (NOT about writing style)",
    phrases: [
      "that is not what", "thats not what", "you did not", "you didnt", "no i said",
      "stop doing", "this is wrong", "not correct", "forget it", "never mind",
      "why did you", "i never asked", "that is wrong", "it doesnt work",
      "it does not work", "still broken", "you broke",
    ],
    words: [],
  },
};

const STYLE_KEYS = Object.keys(SIGNALS).filter((k) => SIGNALS[k].family === "style");

/** Very short bare rejections read as frustration even with no keyword in them. */
const BARE_REJECT = new Set(["no", "nope", "wrong", "stop", "", "?", "??", "???"]);

/**
 * Returns [{ signal, pattern }] - the pattern is kept so that every count in
 * the report can be traced back to the exact string that produced it. Without
 * that, tuning these patterns is guesswork: you see "57 people asked for
 * shorter answers" and no way to tell how many of those are real.
 */
function detectSignals(raw) {
  const norm = " " + normalize(raw) + " ";
  const tokens = norm.split(" ").filter(Boolean);
  const found = [];
  for (const [key, def] of Object.entries(SIGNALS)) {
    let pattern = null;
    // Pad phrases with spaces so "in one" cannot match inside "organised in one-off";
    // substring matching on unpadded text was the single largest source of noise.
    for (const p of def.phrases) {
      if (norm.includes(" " + p + " ") || norm.includes(" " + p)) {
        if (new RegExp("(^| )" + p.replace(/ /g, " ") + "( |$)").test(norm)) {
          pattern = p;
          break;
        }
      }
    }
    if (!pattern) {
      for (const w of def.words) {
        if (fuzzyHas(tokens, w.word, w.avoid)) { pattern = "~" + w.word; break; }
      }
    }
    if (pattern) found.push({ signal: key, pattern });
  }
  // A bare "no" or "wrong" is a real correction. An ALL-CAPS "shouting"
  // heuristic was tried here and deleted: acronyms in pasted text (ISO, DITA,
  // HUMANS) set it off constantly, so it measured formatting, not feeling.
  const bare = BARE_REJECT.has(norm.trim()) || (/^ (no|nope)\b/.test(norm) && tokens.length <= 4);
  if (bare && !found.some((f) => f.signal === "task_frustration")) {
    found.push({ signal: "task_frustration", pattern: "<bare rejection>" });
  }
  return found;
}

// ------------------------------------------------------------- task typing

/**
 * The point of bucketing is that one style does not fit every task. A person
 * can want three-line answers for quick questions and a full walkthrough when
 * they are trying to understand unfamiliar code. Aggregate numbers hide that;
 * per-bucket numbers are what turns into "on X do this, on Y do that".
 */
const TASK_RULES = [
  ["debug", /\b(error|errors|bug|fail|failed|failing|broken|crash|traceback|exception|not work|doesnt work|does not work|why is it|fix)\b/],
  ["plan", /\b(plan|design|architect|architecture|approach|strategy|should i|options|which is better|compare|recommend|decide|trade ?off)\b/],
  ["explain", /\b(explain|what is|what are|what does|how does|how do|understand|walk me|meaning|difference between|teach|learn)\b/],
  ["build", /\b(make|create|build|add|implement|write|generate|refactor|update|change|install|setup|set up|run)\b/],
];

function classifyTask(raw) {
  const norm = normalize(raw);
  const words = norm.split(" ").filter(Boolean).length;
  for (const [name, re] of TASK_RULES) if (re.test(norm)) return name;
  if (words <= 15 && /\?/.test(raw)) return "quick_qa";
  if (words <= 15) return "quick_qa";
  return "other";
}

// ------------------------------------------------------------ transcript IO

function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

/**
 * A line counts as a real human message only when origin.kind === "human".
 * Note we do NOT also require promptSource === "typed": voice dictation and
 * pasted text are still the person speaking, and excluding them would quietly
 * drop data from anyone who dictates.
 */
const isHuman = (o) =>
  o && o.type === "user" && !o.isSidechain && o.origin && o.origin.kind === "human";

async function readSession(file) {
  const turns = [];
  let pendingAssistantChars = 0;
  let pendingAssistantSample = "";

  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (o.type === "assistant" && o.message) {
      const t = textOf(o.message.content);
      if (t) {
        pendingAssistantChars += t.length;
        if (!pendingAssistantSample) pendingAssistantSample = t.slice(0, 400);
      }
      continue;
    }
    if (isHuman(o)) {
      const text = cleanUserText(textOf(o.message && o.message.content));
      if (text && text.trim()) {
        turns.push({
          text: text.trim(),
          ts: o.timestamp || null,
          cwd: o.cwd || null,
          model: o.model || null,
          // How much the assistant produced since the previous human turn.
          // This is the number that tells you whether long answers are what
          // actually triggers the complaints.
          prevAssistantChars: pendingAssistantChars,
          prevAssistantSample: pendingAssistantSample,
        });
      }
      pendingAssistantChars = 0;
      pendingAssistantSample = "";
    }
  }
  return turns;
}

// ------------------------------------------------------------------- driver

function listProjectDirs() {
  if (!existsSync(PROJECTS_ROOT)) return [];
  if (has("--project")) {
    const arg = val("--project", ".");
    const slug = arg === "." ? slugify(resolve(process.cwd())) : arg.includes("/") || arg.includes("\\") ? slugify(resolve(arg)) : arg;
    const dir = join(PROJECTS_ROOT, slug);
    return existsSync(dir) ? [slug] : [];
  }
  return readdirSync(PROJECTS_ROOT).filter((d) => {
    try {
      return statSync(join(PROJECTS_ROOT, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

async function main() {
  const cutoff = Date.now() - DAYS * 86400000;
  const projects = listProjectDirs();

  const stats = {
    projectsScanned: 0,
    sessionsScanned: 0,
    sessionsSkippedOld: 0,
    humanMessages: 0,
  };
  const signalCounts = Object.fromEntries(Object.keys(SIGNALS).map((k) => [k, 0]));
  const examples = Object.fromEntries(Object.keys(SIGNALS).map((k) => [k, []]));
  const byTask = {};
  const repairedLens = [];
  const cleanLens = [];
  let filesRead = 0;

  for (const proj of projects) {
    // Naming a project explicitly overrides the exclusion list - if you asked
    // for that project, you meant it.
    if (!has("--project") && EXCLUDE.some((x) => proj.toLowerCase().includes(x))) continue;
    const dir = join(PROJECTS_ROOT, proj);
    let files;
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }
    let usedThisProject = false;

    for (const f of files) {
      if (filesRead >= MAX_SESSIONS) break;
      const full = join(dir, f);
      let mtime;
      try {
        mtime = statSync(full).mtimeMs;
      } catch {
        continue;
      }
      if (mtime < cutoff) {
        stats.sessionsSkippedOld++;
        continue;
      }
      filesRead++;
      stats.sessionsScanned++;
      usedThisProject = true;

      let turns;
      try {
        turns = await readSession(full);
      } catch {
        continue;
      }

      for (const turn of turns) {
        stats.humanMessages++;
        const task = classifyTask(turn.text);
        byTask[task] ||= { total: 0, signals: Object.fromEntries(Object.keys(SIGNALS).map((k) => [k, 0])) };
        byTask[task].total++;

        const found = detectSignals(turn.text);
        // Only STYLE complaints count as a "repair". Task frustration is
        // recorded but must not drag the style numbers around with it.
        const isStyleRepair = found.some((f) => SIGNALS[f.signal].family === "style");
        if (turn.prevAssistantChars > 0) {
          (isStyleRepair ? repairedLens : cleanLens).push(turn.prevAssistantChars);
        }

        for (const f of found) {
          signalCounts[f.signal]++;
          byTask[task].signals[f.signal]++;
          if (examples[f.signal].length < N_EXAMPLES) {
            examples[f.signal].push({
              project: proj,
              ts: turn.ts,
              task,
              matchedBy: f.pattern,
              quote: turn.text.slice(0, 220).replace(/\s+/g, " "),
              precedingAssistantChars: turn.prevAssistantChars,
            });
          }
        }
      }
    }
    if (usedThisProject) stats.projectsScanned++;
    if (filesRead >= MAX_SESSIONS) break;
  }

  const sumStyle = (counts) => STYLE_KEYS.reduce((a, k) => a + (counts[k] || 0), 0);
  const totalStyleRepairs = sumStyle(signalCounts);

  const taskSummary = Object.fromEntries(
    Object.entries(byTask)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([task, d]) => {
        const repairs = sumStyle(d.signals);
        return [
          task,
          {
            messages: d.total,
            styleRepairs: repairs,
            styleRepairRatePct: d.total ? +((repairs / d.total) * 100).toFixed(1) : 0,
            taskFrustration: d.signals.task_frustration || 0,
            wantsMoreDetail: d.signals.ask_more || 0,
            signals: d.signals,
          },
        ];
      })
  );

  const report = {
    generatedAt: new Date().toISOString(),
    window: { days: DAYS, scope: has("--project") ? val("--project", ".") : "all-projects" },
    stats,
    totals: {
      humanMessages: stats.humanMessages,
      styleRepairMessages: totalStyleRepairs,
      styleRepairRatePct: stats.humanMessages
        ? +((totalStyleRepairs / stats.humanMessages) * 100).toFixed(1)
        : 0,
      taskFrustrationMessages: signalCounts.task_frustration,
      wantsMoreDetail: signalCounts.ask_more,
    },
    signalCounts,
    signalMeta: Object.fromEntries(
      Object.entries(SIGNALS).map(([k, v]) => [k, { label: v.label, family: v.family }])
    ),
    // If the repaired median is much higher than the clean median, length is
    // the problem. If they are close, the problem is vocabulary or structure,
    // and cutting length further will not help.
    answerLength: {
      medianCharsBeforeRepair: median(repairedLens),
      medianCharsBeforeNormalTurn: median(cleanLens),
      repairSample: repairedLens.length,
      normalSample: cleanLens.length,
    },
    byTaskType: taskSummary,
    // Guard rails, printed inside the report so whoever reads it cannot skip
    // them. Pattern matching over free text produces candidates, not facts:
    // on this corpus the first version of these patterns was ~75% wrong. The
    // fix is not more regex, it is a human or a model reading the quotes.
    howToRead: {
      countsAreCandidates:
        "Every count is a candidate. Read examples[].quote and examples[].matchedBy and discard the false positives before drawing any conclusion.",
      sampleSize:
        totalStyleRepairs < 10
          ? "TOO FEW style signals to justify changing the profile. Report this honestly instead of inventing a trend."
          : totalStyleRepairs < 30
            ? "Thin evidence. Propose at most one change, and say it is provisional."
            : "Enough signal to propose per-task-type changes.",
      taskFrustrationIsNotStyle:
        "task_frustration counts measure work going wrong, not writing going wrong. Never edit the communication profile because of them.",
      lengthReading:
        "If medianCharsBeforeRepair is much higher than medianCharsBeforeNormalTurn, length is the problem. If they are close, the problem is vocabulary or structure and cutting length will not help.",
    },
    examples,
  };

  const json = JSON.stringify(report, null, 2);
  if (OUT) writeFileSync(OUT, json, "utf8");
  if (QUIET) {
    if (!OUT) process.stdout.write(json);
  } else {
    process.stdout.write(json);
  }
}

main().catch((e) => {
  console.error("analyze-sessions failed:", e.message);
  process.exit(1);
});
