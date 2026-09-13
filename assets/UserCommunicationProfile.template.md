# User communication profile

Owner: {{NAME_OR_ACCOUNT}}
Created: {{YYYY-MM-DD}}
Base framework: {{FRAMEWORK}}

<!--
  Everything between the two SPEAKSIMPLE markers below is injected into every
  session by the SessionStart hook, and copied into CLAUDE.md by install.mjs.
  Keep it under ~1200 characters and keep every line checkable.
  Do not rename or remove the markers - the hook finds this block by exact
  string match, and fails silently if it is missing.
-->

<!-- SPEAKSIMPLE:BEGIN -->
## How to answer me

- {{RULE_ANSWER_FIRST}}
- {{RULE_LENGTH}}
- {{RULE_VOCABULARY}}
- {{RULE_STRUCTURE}}
- {{RULE_CODE}}
- Never: {{BANNED_LIST}}
- When I ask you to explain, teach, or go deep, the limits above are off.
  These are defaults, not a ceiling.
<!-- SPEAKSIMPLE:END -->

## Why this base framework

{{FRAMEWORK}} — {{ONE_OR_TWO_SENTENCES_OF_REASONING}}

See `references/frameworks.md` for what this controls.

## By task type

<!-- Delete this section entirely if the preference is the same everywhere.
     An invented rule gets followed exactly as literally as a real one. -->

| Task | What I want |
|---|---|
| `quick_qa` — short questions | {{...}} |
| `explain` — teaching me something | {{...}} |
| `build` — writing or changing code | {{...}} |
| `debug` — something is broken | {{...}} |
| `plan` — deciding an approach | {{...}} |

## Banned

- {{...}}

## Evidence

Interview, {{YYYY-MM-DD}}:

- Main uses: {{...}}
- First language: {{...}}
- Reading behaviour: {{...}}
- Concept explanation, picked: {{A|B|C|D}} — {{which style that was}}
- Decision answer, picked: {{A|B|C|D}} — {{which style that was}}
- Reasoning wanted: {{...}}
- In their own words, what annoys them: "{{VERBATIM}}"

<!-- Mode 3 appends dated findings here. Keep the quotes: they are the only
     defence against a profile that drifts on the basis of nothing. -->

## Changelog

| Date | Change | Why |
|---|---|---|
| {{YYYY-MM-DD}} | Created | Interview |
