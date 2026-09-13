#!/usr/bin/env node
/**
 * SpeakSimple setup.
 *
 * Wires three things so the profile survives being forgotten:
 *   1. a SessionStart hook in settings.json  (fires on startup/resume/clear/compact)
 *   2. optionally a UserPromptSubmit hook    (fires every turn - stronger, costs tokens)
 *   3. a short marked block at the TOP of CLAUDE.md
 *
 * Everything it writes is fenced by markers and backed up first, so --uninstall
 * is a genuine undo rather than a hopeful one. People let a tool touch their
 * global config exactly once; a tool that mangles a settings file does not get
 * a second chance, and it would not deserve one.
 *
 * Usage:
 *   node install.mjs --gate                PASS/FAIL: is this copy installed?
 *   node install.mjs --to global|project   install this source copy of the skill
 *   node install.mjs --check               report the setup
 *   node install.mjs --install             wire the hook and the CLAUDE.md block
 *   node install.mjs --disable / --enable  turn the style off and on
 *   node install.mjs --uninstall [--purge] remove; --purge deletes the style too
 *
 * SCOPE IS NOT A FLAG. It is derived from where this skill is installed:
 *
 *   ~/.claude/skills/speaksimple           -> style applies to all projects
 *   ~/.agents/skills/speaksimple           -> style applies to all projects
 *   <project>/.claude/skills/speaksimple   -> style applies to that project
 *   <project>/.agents/skills/speaksimple   -> style applies to that project
 *
 * The .agents forms are what `npx skills add anodeaGr/speaksimple-skill` writes.
 *
 * The style file lives INSIDE the skill folder, beside this script. One
 * directory holds the skill and its data, so nothing belonging to this skill
 * can exist anywhere else, and the scope can never disagree with the location.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, cpSync, rmSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_HOOK = resolve(HERE, "speaksimple-context.mjs").replace(/\\/g, "/");
const MARK_BEGIN = "<!-- SPEAKSIMPLE:BEGIN -->";
const MARK_END = "<!-- SPEAKSIMPLE:END -->";
const SESSION_MATCHER = "startup|resume|clear|compact";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};

const dryRun = has("--dry-run");
const everyTurn = has("--every-turn");

const nrm = (p) => String(p).replace(/\\/g, "/").replace(/\/+$/, "");
const lc = (p) => nrm(p).toLowerCase();

/**
 * THE SCOPE RULE: the style file lives where the skill lives.
 *
 *   skill in <project>/.claude/skills/speaksimple  ->  style is that project's
 *   skill in ~/.claude/skills/speaksimple          ->  style is global
 *
 * Scope is derived from the skill's own location. It is not a flag, and there
 * is no default to get wrong, because every scope bug in this skill's history
 * came from deriving the scope from something other than the thing that owns
 * the file - the working directory, a flag, a fallback search. The skill
 * folder is the one location that is never ambiguous.
 *
 * The style file sits INSIDE the skill folder for the same reason. One
 * directory holds the skill and its data, so "where is my style?" has the same
 * answer as "where is the skill?", and nothing of this skill's can exist
 * anywhere else.
 */
const SKILL_ROOT = resolve(HERE, "..");
const SKILL_NAME = "speaksimple";
// The repository slug, which is NOT the skill name. The skill is invoked as
// /speaksimple; the repository says "skill" in its name so a reader can tell
// what it holds without opening it. Keeping the two apart means renaming one
// never silently renames the other.
const REPO = "anodeaGr/speaksimple-skill";
const HOME_SKILLS = join(homedir(), ".claude", "skills");
const GLOBAL_SKILL = join(HOME_SKILLS, SKILL_NAME);

/**
 * A skills directory is any <base>/.<agent>/skills/ folder:
 *
 *   ~/.claude/skills/speaksimple           -> global   (manual, or --to global)
 *   ~/.agents/skills/speaksimple           -> global   (npx skills add)
 *   <project>/.claude/skills/speaksimple   -> project
 *   <project>/.agents/skills/speaksimple   -> project  (npx skills add)
 *
 * The agent folder is matched by shape, not by name, because the skills CLI
 * writes a different one for each agent: .claude, .agents, .cursor, .codex.
 * What makes a copy installed is that it sits in a skills directory. Which
 * agent owns that directory changes nothing about the scope, so naming only
 * .claude here would report every install the CLI performs as unmanaged.
 *
 * The config this installer edits stays Claude Code's either way. Hooks and
 * CLAUDE.md are Claude Code features, so settings.json and CLAUDE.md are read
 * from .claude even when the skill itself lives under .agents.
 */
const SKILLS_DIR = /^(.*)\/\.[A-Za-z0-9_.-]+\/skills\/[^/]+$/i;

function classifyLocation(root) {
  const m = nrm(root).match(SKILLS_DIR);
  // Anywhere else: a source checkout, a download, a trial folder. Not installed.
  if (!m) return { kind: "unmanaged", projectDir: null };
  if (lc(m[1]) === lc(homedir())) return { kind: "global", projectDir: null };
  return { kind: "project", projectDir: m[1] };
}

const location = classifyLocation(SKILL_ROOT);
const scope = location.kind === "project" ? "project" : "user";
const projectDir = location.projectDir;

/**
 * Everything this skill owns lives in the skill folder. Everything it must
 * modify to work (the hook entry, the CLAUDE.md block) lives in the config
 * directory that matches the skill's scope. Nothing else is touched.
 */
const baseDir = scope === "project" ? join(projectDir, ".claude") : join(homedir(), ".claude");
const settingsPath = join(baseDir, "settings.json");
const claudeMdPath = scope === "project" ? join(projectDir, "CLAUDE.md") : join(baseDir, "CLAUDE.md");
const profilePath = join(SKILL_ROOT, "UserCommunicationProfile.md");
const disabledFlag = join(SKILL_ROOT, "DISABLED");

const fwd = (p) => String(p).replace(/\\/g, "/");
const samePath = (a, b) => fwd(a).toLowerCase().replace(/\/+$/, "") === fwd(b).toLowerCase().replace(/\/+$/, "");

/**
 * Scope containment. Nothing may be read, written or REPORTED outside the
 * scope in force.
 *
 * A project-scoped run touches only files under the project directory. A
 * user-scoped run touches only files under the home directory. There is no
 * third case and no fallback between them.
 *
 * This exists because the fallback happened: a project-scoped run reported
 * "This project has a style file: ~/.claude/speaksimple/..." - a file from the
 * user's home directory presented as belonging to the folder they were
 * standing in. Silently widening scope is worse than failing, because the user
 * cannot see it happen.
 *
 * Runs at startup, before anything is read, so a mistake is a loud refusal
 * rather than a wrong path inside a status report.
 */
function assertWithinScope(paths) {
  if (location.kind === "unmanaged") {
    console.error(
      "REFUSING: this copy of the skill is not installed.\n" +
        "  It is at: " + fwd(SKILL_ROOT) + "\n" +
        "An installed skill lives in a skills directory, like one of these:\n" +
        "  " + fwd(GLOBAL_SKILL) + "                 (all projects)\n" +
        "  <project>/.claude/skills/" + SKILL_NAME + "   (that project only)\n" +
        "Install it in one of two ways:\n" +
        "  npx skills add " + REPO + "   (the skills CLI puts it there)\n" +
        "  --to global  or  --to project            (copy this folder yourself)\n" +
        "The style file is then created in that folder."
    );
    process.exit(4);
  }
  const root = lc(scope === "project" ? projectDir : homedir());
  const bad = paths.filter((p) => !lc(p).startsWith(root + "/"));
  if (bad.length) {
    console.error(
      "REFUSING: scope is '" + scope + "' but these paths fall outside " + root + ":\n  " +
        bad.map(fwd).join("\n  ") +
        "\nNothing was read or written. This is a bug in the skill, not in your setup."
    );
    process.exit(3);
  }
}

// `--to` is the one command that runs from an uninstalled copy - it is what
// installs it - so it must be reachable before the containment check refuses.
if (!has("--to") && !has("--gate")) assertWithinScope([settingsPath, claudeMdPath, profilePath]);

// The hook always points at the skill that owns the style, which is this one.
const hookTarget = fwd(join(SKILL_ROOT, "scripts", "speaksimple-context.mjs"));

/**
 * The exact style file is baked into the hook command.
 *
 * The hook could search for a profile instead, but then a leftover file
 * somewhere else could be picked up silently, which is the surprise this
 * whole scope change exists to remove. An explicit path means the hook loads
 * that file or nothing, and `--check` can verify the same path the hook uses.
 */
const cmd = 'node "' + hookTarget + '" --profile "' + fwd(profilePath) + '"';

// ---------------------------------------------------------------- helpers

function readJson(p) {
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error("REFUSING: " + p + " is not valid JSON (" + e.message + "). Fix it by hand first.");
    process.exit(1);
  }
}

function backup(p) {
  if (!existsSync(p)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const b = p + ".speaksimple-backup-" + stamp;
  if (!dryRun) copyFileSync(p, b);
  return fwd(b);
}

function ensureDir(p) {
  if (!dryRun) mkdirSync(dirname(p), { recursive: true });
}

// Matches any SpeakSimple hook entry: the current form (the skill's own
// scripts/speaksimple-context.mjs, at whatever path) and the legacy copied
// hook.mjs that older installs wrote. Re-installing or uninstalling therefore
// cleans up whichever form is already in settings.json.
const OURS = /speaksimple-context\.mjs|speaksimple[/\\]hook\.mjs/;
const isOurs = (entry) =>
  (entry.hooks || []).some((h) => typeof h.command === "string" && OURS.test(h.command));

function addHook(settings, event, matcher) {
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks[event]) settings.hooks[event] = [];
  // Drop any previous SpeakSimple entry first, so re-running is idempotent
  // instead of stacking duplicate injections.
  settings.hooks[event] = settings.hooks[event].filter((e) => !isOurs(e));
  const entry = { hooks: [{ type: "command", command: cmd }] };
  if (matcher) entry.matcher = matcher;
  settings.hooks[event].push(entry);
}

function removeHook(settings, event) {
  if (!settings.hooks || !settings.hooks[event]) return false;
  const before = settings.hooks[event].length;
  settings.hooks[event] = settings.hooks[event].filter((e) => !isOurs(e));
  const after = settings.hooks[event].length;
  if (after === 0) delete settings.hooks[event];
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  return before !== after;
}

function hookInstalled(settings, event) {
  const list = (settings.hooks && settings.hooks[event]) || [];
  return list.some(isOurs);
}

/** Put the block at the very top - text further down a long file gets skimmed. */
function upsertClaudeMd(block) {
  const wrapped = MARK_BEGIN + "\n" + block + "\n" + MARK_END;
  let text = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf8") : "";
  const i = text.indexOf(MARK_BEGIN);
  const j = text.indexOf(MARK_END);
  if (i !== -1 && j > i) {
    text = text.slice(0, i) + wrapped + text.slice(j + MARK_END.length);
  } else {
    text = wrapped + (text ? "\n\n" + text : "\n");
  }
  ensureDir(claudeMdPath);
  if (!dryRun) writeFileSync(claudeMdPath, text, "utf8");
}

function stripClaudeMd() {
  if (!existsSync(claudeMdPath)) return false;
  const text = readFileSync(claudeMdPath, "utf8");
  const i = text.indexOf(MARK_BEGIN);
  const j = text.indexOf(MARK_END);
  if (i === -1 || j <= i) return false;
  const out = (text.slice(0, i) + text.slice(j + MARK_END.length)).replace(/^\s+/, "");
  if (!dryRun) writeFileSync(claudeMdPath, out, "utf8");
  return true;
}

const DEFAULT_BLOCK = [
  "## How to answer me",
  "",
  "SpeakSimple profile is not written yet. Run `/speaksimple learn` to create it.",
].join("\n");

/** The CLAUDE.md block is copied from the profile, so the two cannot drift apart. */
function blockFromProfile() {
  if (!existsSync(profilePath)) return DEFAULT_BLOCK;
  const t = readFileSync(profilePath, "utf8");
  const i = t.indexOf(MARK_BEGIN);
  const j = t.indexOf(MARK_END);
  if (i === -1 || j <= i) return DEFAULT_BLOCK;
  const inner = t.slice(i + MARK_BEGIN.length, j).trim();
  return inner + "\n\nFull profile (read it if these rules are not enough): " + fwd(profilePath);
}

// ------------------------------------------------------------------ modes

/**
 * Turn the style off, or back on, without deleting anything.
 *
 * A flag file rather than removing the hook, for two reasons. It is reversible
 * in one step, so nothing the user spent five minutes on is at risk. And the
 * hook keeps running, so `--check` can still say "installed but off" instead of
 * "not installed" - two very different states that would otherwise look
 * identical and send the user back through the interview.
 */
function setDisabled(off) {
  if (off) {
    if (!dryRun) {
      mkdirSync(dirname(disabledFlag), { recursive: true });
      writeFileSync(disabledFlag, new Date().toISOString() + "\nDelete this file to turn the style back on.\n", "utf8");
    }
  } else if (existsSync(disabledFlag) && !dryRun) {
    rmSync(disabledFlag, { force: true });
  }
  console.log(JSON.stringify({
    action: off ? "disabled" : "enabled",
    scope: scope,
    flagFile: fwd(disabledFlag),
    styleActive: !off,
    note: off
      ? "The hook still runs but sends nothing. Already-open sessions keep the rules until they restart or /clear."
      : "The style is on again. Restart Claude Code or run /clear for it to load.",
  }, null, 2));
}

function check() {
  const s = readJson(settingsPath);
  const md = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf8") : "";
  const sessionStartHook = hookInstalled(s, "SessionStart");
  const out = {
    scope: scope,
    profile: { path: fwd(profilePath), exists: existsSync(profilePath) },
    settings: { path: fwd(settingsPath), exists: existsSync(settingsPath) },
    sessionStartHook: sessionStartHook,
    // "installed but switched off" and "not installed" look the same to a
    // user and mean completely different things, so they are separate fields.
    disabled: existsSync(disabledFlag),
    disabledFlag: fwd(disabledFlag),
    userPromptSubmitHook: hookInstalled(s, "UserPromptSubmit"),
    claudeMd: {
      path: fwd(claudeMdPath),
      exists: existsSync(claudeMdPath),
      blockPresent: md.indexOf(MARK_BEGIN) !== -1,
    },
    skill: {
      path: fwd(SKILL_ROOT),
      // "global" = installed in ~/.claude/skills, style applies everywhere.
      // "project" = installed in <project>/.claude/skills, style is that
      // project's. "unmanaged" = a source copy, not installed anywhere.
      installedAs: location.kind,
      appliesTo: location.kind === "project" ? fwd(projectDir) : "all projects",
    },
    hookScript: {
      // The path the settings entry actually points at. exists:false means the
      // style has stopped working silently.
      path: hookTarget,
      exists: existsSync(hookTarget),
    },
    ready: sessionStartHook && existsSync(profilePath) && existsSync(hookTarget) && !existsSync(disabledFlag),
  };
  console.log(JSON.stringify(out, null, 2));
}

/**
 * Install an unmanaged copy of the skill into a real skill directory.
 *
 * `--to global`  -> ~/.claude/skills/speaksimple      (style applies everywhere)
 * `--to project` -> <cwd>/.claude/skills/speaksimple  (style is that project's)
 *
 * This is the only moment the scope is decided, and the user decides it: after
 * the copy, the skill's own location IS the scope, permanently. Moving the
 * folder later moves the style with it, which is the point of keeping them in
 * one directory.
 *
 * An already-installed skill is never relocated. Relocating would silently
 * change which projects the style applies to, and a scope that changes because
 * a tool tidied a folder is exactly the class of surprise this design removes.
 */
function installTo(target) {
  if (!existsSync(join(SKILL_ROOT, "SKILL.md"))) {
    console.error("REFUSING: " + fwd(SKILL_ROOT) + " does not look like the skill folder (no SKILL.md).");
    process.exit(1);
  }
  if (existsSync(join(SKILL_ROOT, "UserCommunicationProfile.md"))) {
    console.error(
      [
        "REFUSING: this source folder contains a style file.",
        "Copying it would hand your style to everyone who installs from here.",
        "Move or delete " + fwd(join(SKILL_ROOT, "UserCommunicationProfile.md")) + " first.",
      ].join("\n")
    );
    process.exit(1);
  }
  const dest =
    target === "project"
      ? join(resolve(process.cwd()), ".claude", "skills", SKILL_NAME)
      : GLOBAL_SKILL;
  if (!dryRun) {
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(SKILL_ROOT, dest, { recursive: true, force: true });
  }
  console.log(JSON.stringify({
    action: dryRun ? "dry-run" : "installed skill",
    from: fwd(SKILL_ROOT),
    to: fwd(dest),
    scope: target === "project" ? "this project only" : "all projects",
    styleFileWillBe: fwd(join(dest, "UserCommunicationProfile.md")),
    next: "Run install.mjs --install from " + fwd(dest) + "/scripts to wire the hook.",
  }, null, 2));
  process.exit(0);
}

function install() {
  if (!existsSync(SOURCE_HOOK)) {
    console.error("REFUSING: cannot find the hook script at " + SOURCE_HOOK);
    process.exit(1);
  }

  const s = readJson(settingsPath);
  const settingsBackup = backup(settingsPath);
  addHook(s, "SessionStart", SESSION_MATCHER);
  if (everyTurn) addHook(s, "UserPromptSubmit", null);
  else removeHook(s, "UserPromptSubmit");
  ensureDir(settingsPath);
  if (!dryRun) writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n", "utf8");

  const claudeMdBackup = backup(claudeMdPath);
  upsertClaudeMd(blockFromProfile());

  console.log(JSON.stringify({
    action: dryRun ? "dry-run" : "installed",
    scope: scope,
    settings: fwd(settingsPath),
    settingsBackup: settingsBackup,
    claudeMd: fwd(claudeMdPath),
    claudeMdBackup: claudeMdBackup,
    sessionStartHook: true,
    userPromptSubmitHook: everyTurn,
    skillPath: fwd(SKILL_ROOT),
    appliesTo: location.kind === "project" ? fwd(projectDir) : "all projects",
    hookScript: hookTarget,
    styleFile: fwd(profilePath),
    profileExpectedAt: fwd(profilePath),
    note: "NOT ACTIVE YET. SessionStart hooks fire when a session starts, so this one has not run in the current session. Restart Claude Code or run /clear, then verify.",
  }, null, 2));
}

function uninstall() {
  const s = readJson(settingsPath);
  const settingsBackup = backup(settingsPath);
  const a = removeHook(s, "SessionStart");
  const b = removeHook(s, "UserPromptSubmit");
  if (!dryRun && existsSync(settingsPath)) {
    writeFileSync(settingsPath, JSON.stringify(s, null, 2) + "\n", "utf8");
  }
  const claudeMdBackup = backup(claudeMdPath);
  const c = stripClaudeMd();
  // Legacy cleanup: earlier versions kept a copy of the hook script here.
  // Nothing writes it any more, but existing installs still have one.
  const legacyHookCopy = join(baseDir, "speaksimple", "hook.mjs");
  let removedHookCopy = false;
  if (existsSync(legacyHookCopy)) {
    if (!dryRun) rmSync(legacyHookCopy, { force: true });
    removedHookCopy = true;
  }

  /**
   * --purge additionally deletes the user's style file and reports, so
   * "start again from nothing" is a real option. Without it there was no way
   * back to a clean state: uninstalling left the profile, and the next help
   * run announced a saved style the user could not remember creating.
   *
   * It is opt-in because the profile is the one thing here that took the user
   * five minutes to produce and cannot be regenerated from anything else.
   */
  /**
   * Delete the user's data, which now lives in the skill folder beside the
   * skill's own code. So this removes a NAMED LIST of files, never a directory.
   *
   * The previous version did `rmSync(dir, {recursive:true})` on a data folder
   * that no longer exists, which made --purge a silent no-op: the style file
   * survived and the output still said "Your style file was kept", while the
   * user had just asked to delete everything and start again. Pointing that
   * same recursive delete at the skill folder would have destroyed the skill.
   */
  const dataFiles = [
    join(SKILL_ROOT, "UserCommunicationProfile.md"),
    join(SKILL_ROOT, "DISABLED"),
  ];
  try {
    for (const f of readdirSync(SKILL_ROOT)) {
      if (/^metalearning_\d+\.md$/i.test(f)) dataFiles.push(join(SKILL_ROOT, f));
    }
  } catch {
    /* unreadable skill folder: the named files below are still attempted */
  }
  const profilesDir = join(SKILL_ROOT, "profiles");
  if (existsSync(profilesDir)) {
    try {
      for (const f of readdirSync(profilesDir)) dataFiles.push(join(profilesDir, f));
    } catch {
      /* ignore */
    }
  }

  let purged = false;
  if (has("--purge")) {
    const present = dataFiles.filter((f) => existsSync(f));
    if (present.length) {
      purged = present.map(fwd);
      if (!dryRun) for (const f of present) rmSync(f, { force: true });
      if (!dryRun && existsSync(profilesDir)) {
        try {
          if (readdirSync(profilesDir).length === 0) rmSync(profilesDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  }

  console.log(JSON.stringify({
    action: dryRun ? "dry-run" : "uninstalled",
    scope: scope,
    removedSessionStart: a,
    removedUserPromptSubmit: b,
    removedClaudeMdBlock: c,
    removedHookCopy: removedHookCopy,
    settingsBackup: settingsBackup,
    claudeMdBackup: claudeMdBackup,
    purgedFiles: purged || false,
    note: purged
      ? "Your style file was DELETED. This cannot be undone."
      : "Your style file was kept. Add --purge to delete it too.",
  }, null, 2));
}

/**
 * The gate. Two lines, for an agent to branch on without parsing JSON.
 *
 * It answers the one question that must be settled before anything is
 * written: is this copy installed in a skills directory, so the scope is
 * known? Everything else - the profile, the hook, the CLAUDE.md block - is
 * repairable. A wrong scope is not, because the user cannot see it.
 *
 * Exit code 0 = PASS, 1 = FAIL. It changes nothing.
 */
function gate() {
  if (location.kind === "unmanaged") {
    console.log(
      [
        "FAIL",
        "skill: " + fwd(SKILL_ROOT),
        "reason: this copy is not installed in a skills directory, so the scope is unknown.",
        "fix: npx skills add " + REPO,
        "or: node \"" + fwd(join(SKILL_ROOT, "scripts", "install.mjs")) + "\" --to global",
      ].join("\n")
    );
    process.exit(1);
  }
  console.log(
    [
      "PASS",
      "skill: " + fwd(SKILL_ROOT),
      "scope: " + (location.kind === "project" ? fwd(projectDir) : "all projects"),
      "style: " + (existsSync(profilePath) ? fwd(profilePath) : "not created yet"),
    ].join("\n")
  );
  process.exit(0);
}

if (has("--gate")) gate();

const to = val("--to", null);
if (to === "global" || to === "project") installTo(to);
else if (to) {
  console.error("--to must be 'global' or 'project'.");
  process.exit(1);
}

if (has("--disable")) setDisabled(true);
else if (has("--enable")) setDisabled(false);
else if (has("--uninstall")) uninstall();
else if (has("--install")) install();
else check();
