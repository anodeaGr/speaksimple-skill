#!/usr/bin/env node
/**
 * SpeakSimple help text.
 *
 * Two rules govern every string in this file.
 *
 * 1. It is a script, not prose in a markdown file, because the text must come
 *    out identical every time. When the help lived in `help.md` as "show the
 *    text below", a high-effort model re-rendered ninety lines of it - a wall
 *    of text from a skill that exists to prevent walls of text.
 *
 * 2. It is written in ASD-STE100 Simplified Technical English:
 *      - one instruction per sentence
 *      - imperative verbs for instructions ("Type this", not "you can type")
 *      - active voice, simple present tense
 *      - under 20 words per sentence
 *      - no idioms ("wire it in", "up and running", "start here")
 *      - one word for one meaning: always "style", "setup", "hook"
 *
 * The second rule is why this file shows ONE next action, not a menu of three
 * modes. A menu asks the reader to understand the whole system before they can
 * do anything. A first-time reader has exactly one correct next step, so the
 * help gives them that step and nothing else.
 *
 * Usage:
 *   node help.mjs                  what to do now  (the default)
 *   node help.mjs --help           every command, grouped  (--full is the same)
 *   node help.mjs --after-install  the handover text, printed after setup
 *   node help.mjs --starting-interview  said just before interview question 1
 *   node help.mjs --verify         run the hook now and prove it works
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// --help and --full both print the complete reference. Two names, one text:
// a second long help page would drift out of step with the first.
const full = process.argv.includes("--full") || process.argv.includes("--help");
const afterInstall = process.argv.includes("--after-install");
const startingInterview = process.argv.includes("--starting-interview");
const verify = process.argv.includes("--verify");

/** Single source of truth for state: ask install.mjs rather than re-deriving. */
let stateError = null;

function readState() {
  try {
    const out = execFileSync(process.execPath, [join(HERE, "install.mjs"), "--check"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out);
  } catch (e) {
    // Keep the reason. install.mjs refuses with a real explanation when it
    // cannot identify a project, and swallowing that left the user with
    // "I cannot read the setup" and nothing to act on.
    stateError = (e && e.stderr ? String(e.stderr) : "").trim() || null;
    return null;
  }
}

/** install.mjs explains why it refused; show that instead of a dead end. */
function errorLines() {
  if (!stateError) return [];
  return stateError.split(String.fromCharCode(10)).map(function (l) { return l.trim(); }).filter(Boolean);
}

const s = readState();

/**
 * Each state gives one status and one numbered procedure. The reader does not
 * choose between options and does not need to know what a hook is.
 *
 * Every status names the file it is talking about. This is not decoration.
 * An earlier version defaulted the style to the home directory and told the
 * user "You have a saved style" while they sat in an empty project. That read
 * as a haunting: a claim about state they could not see, check, or find, made
 * about a file created weeks earlier somewhere else. State a user cannot
 * locate is state a user cannot trust.
 *
 * The style is now per project, so an empty project genuinely has none and the
 * interview always starts from nothing. The path is printed either way.
 */
function plan() {
  if (!s) {
    return {
      status: ["I cannot read the setup.", ...errorLines()],
      title: "DO THIS NOW",
      steps: ["Open the project folder. Then type /speaksimple again."],
    };
  }

  const hasProfile = s.profile.exists;
  const hasHook = s.sessionStartHook;
  const hookFileOk = s.hookScript.exists;
  const profilePath = s.profile.path;
  // The scope sentence is derived from where the skill is installed, never
  // asserted. Saying "each project has its own style" to someone running a
  // global install would be false, and a false sentence about scope is what
  // started this.
  const scopeLine =
    s.skill && s.skill.installedAs === "project"
      ? "This style is for this project only."
      : "This style is for all your projects.";

  // Off is not the same as missing. Reported first, and with the way back,
  // because a user who forgot they switched it off would otherwise be told to
  // redo an interview they have already done.
  if (s.disabled) {
    return {
      status: [
        "Your style is OFF. Nothing is deleted.",
        "Your style file:",
        profilePath,
      ],
      title: "TO TURN IT ON",
      steps: [
        "Type: /speaksimple on",
        "I use your style again from that moment.",
      ],
    };
  }

  if (hasHook && hasProfile && hookFileOk) {
    return {
      status: [
        "The setup is complete.",
        scopeLine,
        "Your style file:",
        profilePath,
      ],
      title: "TO CHECK THAT IT WORKS",
      steps: [
        "Type: /speaksimple check",
        "I run the hook now and show you the rules that Claude receives.",
      ],
    };
  }

  if (hasHook && !hookFileOk) {
    return {
      status: [
        "The setup is broken. The hook points to a file that is not there.",
        "Missing file:",
        s.hookScript.path,
      ],
      title: "DO THIS NOW",
      steps: ["Type: repair speaksimple", "I install the file again."],
    };
  }

  if (hasProfile && !hasHook) {
    return {
      status: [
        "A style file exists:",
        profilePath,
        scopeLine,
        "Claude does not use it now. The hook is not installed.",
      ],
      title: "DO THIS NOW",
      steps: [
        "Type: /speaksimple learn",
        "I ask if you want to keep this style or change it. You choose.",
        "Answer yes when I ask to install.",
        "Close Claude Code. Then start it again.",
      ],
    };
  }

  if (!hasProfile && hasHook) {
    return {
      status: [
        "The hook is installed. There is no style file for it to read.",
        "The style file must be here:",
        profilePath,
      ],
      title: "DO THIS NOW",
      steps: [
        "Type: /speaksimple learn",
        "Answer my questions. This takes 5 minutes.",
        "Answer yes when I ask to save.",
      ],
    };
  }

  return {
    status: [
      "There is no style yet. The setup is not started.",
      "Your style will go in this file:",
      profilePath,
      scopeLine,
    ],
    title: "DO THIS NOW",
    steps: [
      "Type: /speaksimple learn",
      "Answer my questions. This takes 5 minutes.",
      "Answer yes when I ask to save.",
      "Close Claude Code. Then start it again.",
    ],
  };
}

function block() {
  const p = plan();
  const out = ["YOUR SETUP", ...p.status, "", p.title];
  p.steps.forEach((step, i) => out.push(`${i + 1}. ${step}`));
  if (s && s.skill && s.skill.installedAs === "unmanaged") {
    out.push("", "Note: this copy of the skill is not installed yet.");
    out.push("Installing it decides who the style is for: this project, or all.");
  }
  return out;
}

const SHORT = [
  "SPEAKSIMPLE",
  "",
  "Claude writes long answers. SpeakSimple makes Claude write in the way that",
  "you want. The new style stays in all your sessions.",
  "",
  ...block(),
  "",
  "To see every command, type: /speaksimple --help",
];

/**
 * The complete command reference, shown by --help.
 *
 * "All the options" has to mean all of them. An earlier version listed three
 * commands and left the reader to discover the rest, which is the same defect
 * as a help screen that shows four of ten writing styles: it redefines "all"
 * as "the ones I chose to mention".
 *
 * Still ASD-STE100: one instruction per line, imperative, no idioms. Grouped
 * by what the reader wants to do, not by how the code is organised, because
 * nobody arrives here wanting to know the internal shape of the skill.
 */
const FULL = [
  "SPEAKSIMPLE - ALL COMMANDS",
  "",
  "Claude writes long answers. SpeakSimple learns how you want Claude to write,",
  "saves it, and reminds Claude in every session.",
  "",
  "It changes HOW Claude writes. It does not change WHAT Claude does.",
  "",
  "",
  "START",
  "",
  "  /speaksimple --install      Set up the skill. Use it once, just after",
  "                              you add the skill. With no style saved, the",
  "                              interview starts. I ask before I change any",
  "                              file.",
  "",
  "  /speaksimple                Start. With no style saved, I begin the",
  "                              interview at once. With a style saved, I show",
  "                              you the status.",
  "",
  "  /speaksimple learn          Make or change your style. I ask 5 questions.",
  "                              This takes 5 minutes. You approve the rules",
  "                              before I save them. Run it again any time to",
  "                              revise.",
  "",
  "",
  "EVERY DAY",
  "",
  "  /speaksimple check          Prove the setup works. I run the hook now and",
  "                              show you the rules that Claude receives. This",
  "                              takes one second and uses no tokens.",
  "",
  "  /speaksimple formats        Show my last answer in the 10 writing styles,",
  "                              plus the unstyled default. Longest first.",
  "                              Say a number to keep that one.",
  "  /speaksimple formats 4      Show only the 4 most different styles.",
  "",
  "  /speaksimple translate      Use your style in this chat only. Saves",
  "                              nothing. Use it when I forget your style in a",
  "                              long chat.",
  "  /speaksimple translate NAME Use a different saved style, this chat only.",
  "",
  "",
  "TURN IT OFF AND ON",
  "",
  "  /speaksimple --off          Off for ONE answer. Nothing is saved. Add your",
  "                              question after it if you want.",
  "  /speaksimple off            Off until you turn it on. Your style file and",
  "                              the hook stay. Nothing is deleted.",
  "  /speaksimple on             On again. I use your style from that moment.",
  "",
  "",
  "CHECK IT IS STILL RIGHT FOR YOU",
  "",
  "  /speaksimple re-align       Read your old sessions. Find where you asked",
  "                              for a different style. Write a report. Propose",
  "                              a change that you approve or refuse.",
  "                              Use this after some weeks of real work.",
  "",
  "",
  "FIX AND REMOVE",
  "",
  "  repair speaksimple          Install the hook again. Use it if the style",
  "                              stops with no error.",
  "  remove speaksimple          Remove the hook and the CLAUDE.md block. Keep",
  "                              your style file. You can install it again",
  "                              later without the interview.",
  "  delete my style and start again",
  "                              Remove everything, including your style file.",
  "                              You cannot undo this.",
  "",
  "",
  "IF THE STYLE IS NOT CORRECT",
  "",
  "This is normal. The first style is a guess from five answers.",
  "",
  "  Answers are too short       /speaksimple learn, then choose revise",
  "  Answers are still too long  the same. Tell me which answer was too long.",
  "  Good for questions, but",
  "    bad for explanations      /speaksimple learn, ask for task rules",
  "  Wrong in this chat only     /speaksimple translate",
  "  The style stopped           repair speaksimple",
  "  You are not sure            /speaksimple re-align",
  "",
  "",
  "WHERE YOUR FILES ARE",
  "",
  "Your style file is inside the skill folder, beside the skill itself.",
  "",
  "The place you install the skill decides who the style is for:",
  "",
  "  ~/.agents/skills/speaksimple            all your projects",
  "  <project>/.agents/skills/speaksimple    that project only",
  "",
  "Your client can use .claude in place of .agents. Both count.",
  "",
  "Your style, your named styles and your reports are only in that folder.",
  "",
  "To work, the skill also adds two marked lines outside it:",
  "",
  "  settings.json    the hook that loads your style at session start",
  "  CLAUDE.md        a copy of your rules, as a second layer",
  "",
  "I back up both files before I change them. \"remove speaksimple\" takes both",
  "lines out again.",
  "",
  "To install a new copy, use the skills tool. It asks who the style is for:",
  "",
  "  npx skills add anodeaGr/speaksimple",
  "",
  "Without that tool, Claude runs one of these for you:",
  "",
  "  install.mjs --to global     install for all projects",
  "  install.mjs --to project    install for this project only",
  "",
  "",
  "GOOD TO KNOW",
  "",
  "The hook runs when a session starts. After setup I use your style at once,",
  "but a restart makes it load by itself in every new session.",
  "",
  "You never type a node command. Ask me and I run it.",
  "",
  "",
];

/**
 * The handover, printed straight after a successful install.
 *
 * It answers the four questions the first real test run left unanswered: is it
 * on, how do I test it, how do I change it, and what did you touch. A user who
 * does not restart sees no change and decides the tool failed. A user who
 * dislikes the style and does not know it is editable decides the same thing.
 */
const AFTER_INSTALL = (() => {
  const ok = s && s.sessionStartHook && s.profile.exists && s.hookScript.exists;
  if (!ok) {
    return [
      "THE SETUP DID NOT COMPLETE.",
      "",
      s ? "Hook installed: " + s.sessionStartHook : "I cannot read the setup.",
      s ? "Style file found: " + s.profile.exists : "",
      "",
      "Do not close Claude Code. Tell me to repair the setup.",
    ].filter((l) => l !== "");
  }
  return [
    "THE SETUP IS COMPLETE. I USE YOUR STYLE FROM NOW ON.",
    "",
    "DO THIS NOW",
    "1. Ask me a question that usually gets a long answer.",
    "2. Read the answer. A short and simple answer means the style works.",
    "",
    "Close Claude Code and start it again when you can. Then the style loads",
    "automatically in every new session, and not only in this one.",
    "",
    "IF THE STYLE IS NOT CORRECT",
    "1. Type: /speaksimple learn",
    "2. Choose revise.",
    "",
    "The first style is a guess from five answers. It is normal to change it.",
    "",
    "I CHANGED THESE FILES",
    "Settings:   " + s.settings.path,
    "Rules:      " + s.claudeMd.path,
    "Your style: " + s.profile.path,
    "The skill:  " + (s.skill ? s.skill.path : "unchanged"),
    "",
    "I made a backup of the settings file and the rules file first.",
  ];
})();

/**
 * Printed when there is no style and the interview is about to start.
 *
 * A menu is the wrong answer to an empty project. There is nothing to choose
 * between: one command is correct and the other two need a style that does not
 * exist. Telling a first-time user to read three options and then type
 * `/speaksimple learn` adds a step and a decision to a path that has neither.
 *
 * So: say what is missing, say what happens next, and ask question 1 in the
 * same message. No stop, no menu, no confirmation.
 */
const STARTING_INTERVIEW = [
  "SPEAKSIMPLE",
  "",
  "This project has no style file. I start the interview now.",
  "",
  "It takes 5 minutes. I ask you 5 questions. Most of them ask you to choose",
  "an answer that you like. At the end I show you the rules. You approve them.",
  "Then I save the file and install it.",
];

/**
 * Real end-to-end proof, not a checklist.
 *
 * `--check` only says the files exist. That is not the same as the style
 * reaching Claude, and the difference matters: a user who cannot verify the
 * setup themselves has to take the tool's word for it, and after one failed
 * install they will not. So this reads the hook command out of settings.json,
 * RUNS it exactly as the harness would, and confirms the rules come back.
 *
 * No model call, so it is instant and free.
 */
function runVerify() {
  const out = ["SPEAKSIMPLE - CHECK", ""];
  if (!s) return [...out, "I cannot read the setup.", ...errorLines()];

  out.push("Style file:  " + (s.profile.exists ? "found" : "NOT FOUND"));
  out.push("  " + s.profile.path);
  out.push("Hook:        " + (s.sessionStartHook ? "installed" : "NOT INSTALLED"));
  out.push("  " + s.settings.path);
  out.push("");

  // Switched off on purpose is not a failure. Reporting it as one - "TEST
  // FAILED, say repair speaksimple" - tells the user their setup broke when
  // they turned it off themselves, and invites them to "fix" a working switch.
  if (s.disabled) {
    out.push("Your style is OFF. You switched it off. Nothing is broken.");
    out.push("");
    out.push("TO TURN IT ON");
    out.push("1. Type: /speaksimple on");
    out.push("2. Close Claude Code. Then start it again.");
    return out;
  }

  if (!s.sessionStartHook || !s.profile.exists) {
    out.push("The setup is not complete.", "", "DO THIS NOW", "1. Type: /speaksimple learn");
    return out;
  }

  // Pull the exact command the harness will run, and run it.
  let cmd = null;
  try {
    const cfg = JSON.parse(readFileSync(s.settings.path, "utf8"));
    for (const entry of cfg.hooks.SessionStart) {
      for (const h of entry.hooks || []) {
        if (typeof h.command === "string" && h.command.includes("speaksimple-context.mjs")) cmd = h.command;
      }
    }
  } catch {
    /* falls through to the failure branch below */
  }
  if (!cmd) return [...out, "I cannot read the hook command. Say: repair speaksimple"];

  let text = "";
  try {
    const m = cmd.match(/^node\s+"([^"]+)"(?:\s+--profile\s+"([^"]+)")?/);
    const args = m[2] ? [m[1], "--profile", m[2]] : [m[1]];
    const raw = execFileSync(process.execPath, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    text = JSON.parse(raw).hookSpecificOutput.additionalContext || "";
  } catch {
    text = "";
  }

  if (!text.trim()) {
    out.push("TEST FAILED. The hook runs but sends no rules.", "");
    out.push("DO THIS NOW", "1. Say: repair speaksimple");
    return out;
  }

  const first = text.split("\n").find((l) => l.trim().startsWith("-")) || "";
  out.push("TEST PASSED. The hook sends your rules to Claude.");
  out.push("");
  out.push("This is the first rule that Claude receives:");
  out.push(" " + first.trim());
  out.push("");
  out.push("If Claude still writes long answers in THIS session, close Claude Code");
  out.push("and start it again. The hook runs only when a session starts.");
  return out;
}

const text = verify
  ? runVerify()
  : startingInterview
  ? STARTING_INTERVIEW
  : afterInstall
    ? AFTER_INSTALL
    : full
      ? FULL
      : SHORT;
process.stdout.write(text.join("\n") + "\n");
