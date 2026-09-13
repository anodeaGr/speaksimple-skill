#!/usr/bin/env node
/**
 * SpeakSimple context hook.
 *
 * Reads the active communication profile and injects its short "answer rules"
 * block into the session as additional context.
 *
 * Wired as a SessionStart hook (fires on startup / resume / clear / compact)
 * and optionally as a UserPromptSubmit hook (fires every turn).
 *
 * Design rule that outranks everything else here: this must never break a
 * session. A missing profile, a malformed file, a locked disk - all of it
 * exits 0 and prints nothing. A person who cannot start Claude because their
 * style hook crashed will rip the whole system out, and they would be right.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BEGIN = "<!-- SPEAKSIMPLE:BEGIN -->";
const END = "<!-- SPEAKSIMPLE:END -->";
const MAX_CHARS = 2500; // keeps the per-session (or per-turn) cost small

function quit() {
  process.exit(0); // silence = no profile, no opinion, no harm
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function resolveProfilePath() {
  // `--profile <path>` is what the installer writes into settings.json. When
  // it is present it is the ONLY file consulted: no searching, no fallback.
  // Searching was the old behaviour and it meant a style file left in the
  // home directory could be picked up in an unrelated project, silently. An
  // explicit path makes the hook load that file or nothing at all.
  const i = process.argv.indexOf("--profile");
  if (i !== -1 && process.argv[i + 1]) {
    const p = process.argv[i + 1];
    return existsSync(p) ? p : null;
  }

  // Fallbacks below only apply to a hand-written hook entry with no --profile.
  const env = process.env.SPEAKSIMPLE_PROFILE;
  if (env && existsSync(env)) return env;

  // Last resort: the style file that belongs to THIS copy of the skill, which
  // sits one directory up from this script.
  //
  // There is deliberately no search of the project or the home directory. A
  // search is how a style file left somewhere else gets loaded into an
  // unrelated project, invisibly, with nothing on screen to explain where the
  // rules came from. The skill owns exactly one style file and it is beside
  // the skill. Where the skill is installed decides the scope; nothing here
  // needs to infer it.
  const own = join(dirname(fileURLToPath(import.meta.url)), "..", "UserCommunicationProfile.md");
  return existsSync(own) ? own : null;
}

function extractBlock(text) {
  const i = text.indexOf(BEGIN);
  const j = text.indexOf(END);
  if (i !== -1 && j > i) return text.slice(i + BEGIN.length, j).trim();
  // No markers: fall back to the first section, so a hand-written profile
  // still does something useful instead of silently doing nothing.
  return text.split(/\n## /)[0].trim();
}

/**
 * A DISABLED file next to the profile switches the hook off.
 *
 * This is the only way to turn the style off durably. Telling Claude to ignore
 * the rules works for one answer, but `/compact`, `/clear` and the next
 * session all re-run this hook and the rules come straight back. A user who
 * asked for the style to stop, and watched it return ten minutes later, has
 * learned the off switch does not work.
 *
 * Checked before anything else so that a disabled profile costs nothing.
 */
function isDisabled(profilePath) {
  try {
    return existsSync(join(dirname(profilePath), "DISABLED"));
  } catch {
    return false;
  }
}

function main() {
  const path = resolveProfilePath();
  if (!path) quit();
  if (isDisabled(path)) quit();

  let block;
  try {
    block = extractBlock(readFileSync(path, "utf8"));
  } catch {
    quit();
  }
  if (!block || block.length < 10) quit();
  if (block.length > MAX_CHARS) block = block.slice(0, MAX_CHARS) + "\n(truncated)";

  let event = "SessionStart";
  try {
    const parsed = JSON.parse(readStdin());
    if (parsed && typeof parsed.hook_event_name === "string") event = parsed.hook_event_name;
  } catch {
    /* stdin is optional; the default event is correct for SessionStart */
  }

  const context = [
    "# How to talk to this user (SpeakSimple profile)",
    "",
    block,
    "",
    `Full profile if you need the reasoning behind these rules: ${path}`,
  ].join("\n");

  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } })
  );
}

try {
  main();
} catch {
  quit();
}
