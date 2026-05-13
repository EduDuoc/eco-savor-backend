# Skill Registry — Eco-Savor Backend

Generated: 2026-05-13 | Mode: engram

## Source

- **User skills**: `~/.config/opencode/skills/` (20 skills installed)
- **Project skills**: None found
- **Project conventions**: `AGENTS.md` (project-level agent instructions)
- **Skills excluded from registry**: `sdd-*`, `_shared`, `skill-registry` (by scan rules)

## Non-SDD Skills

### branch-pr
- **Trigger**: creating, opening, or preparing PRs for review
- **Path**: `~/.config/opencode/skills/branch-pr/SKILL.md`
- **Rules**:
  - MUST link approved issue before PR — no exceptions
  - MUST have exactly one `type:*` label
  - Automated checks must pass before merge
  - Blank PRs blocked by GitHub Actions

### chained-pr
- **Trigger**: PRs over 400 lines, stacked PRs, review slices
- **Path**: `~/.config/opencode/skills/chained-pr/SKILL.md`
- **Rules**:
  - Split PRs over 400 changed lines (unless maintainer approves `size:exception`)
  - Keep each PR reviewable in ≤60 minutes
  - One deliverable work unit per PR; tests/docs with the unit
  - Every child PR must state dependencies and include a dependency diagram marking current PR with 📍
  - Do not mix chain strategies after user chooses one
  - Polluted diffs → retarget or rebase until only current work unit appears

### cognitive-doc-design
- **Trigger**: writing guides, READMEs, RFCs, onboarding, architecture, review-facing docs
- **Path**: `~/.config/opencode/skills/cognitive-doc-design/SKILL.md`
- **Rules**:
  - Lead with the answer (decision/action first, context after)
  - Progressive disclosure: happy path → details → edge cases → references
  - Chunking: group related info, keep flat lists short
  - Signposting: headings, labels, callouts, summaries
  - Recognition over recall: tables, checklists, examples over prose
  - Review empathy: design so reviewers verify intent without reconstructing the whole story

### comment-writer
- **Trigger**: PR feedback, issue replies, reviews, Slack messages, GitHub comments
- **Path**: `~/.config/opencode/skills/comment-writer/SKILL.md`
- **Rules**:
  - Start with actionable point, not recap
  - Warm and direct — sound like a thoughtful teammate, not a corporate bot
  - 1 to 3 paragraphs or a tight bullet list
  - Explain WHY when asking for a change (technical reason)
  - Avoid pile-ons — comment on highest-value issue
  - Match thread language (Rioplatense voseo in Spanish: `podés`, `tenés`, `fijate`)

### go-testing
- **Trigger**: Go tests, go test coverage, Bubbletea teatest, golden files
- **Path**: `~/.config/opencode/skills/go-testing/SKILL.md`
- **Rules**:
  - Table-driven tests with `t.Run(tt.name, ...)` for multiple cases
  - Test behavior and state transitions, not implementation trivia
  - `t.TempDir()` for filesystem tests; never real home directory
  - Integration skippable via `testing.Short()` for external/slow flows
  - Bubbletea: test `Model.Update()` directly; use `teatest` only for interactive flows
  - Golden files deterministic; update only through repo's `-update` path
  - Small mocks/interfaces around system or command execution boundaries

### issue-creation
- **Trigger**: creating GitHub issues, bug reports, feature requests
- **Path**: `~/.config/opencode/skills/issue-creation/SKILL.md`
- **Rules**:
  - MUST use a template (blank issues disabled)
  - Every issue gets `status:needs-review` on creation
  - A maintainer MUST add `status:approved` before any PR can be opened
  - Questions go to Discussions, not issues

### judgment-day
- **Trigger**: judgment day, dual review, adversarial review, juzgar
- **Path**: `~/.config/opencode/skills/judgment-day/SKILL.md`
- **Rules**:
  - Resolve project skills before launching: read registry, match compact rules, inject into judge prompts
  - Launch TWO blind judges in parallel with identical target and criteria — never review code yourself
  - Wait for both judges before synthesis; never accept partial verdict
  - Classify warnings: `WARNING (real)` only if normal intended use can trigger; else downgrade to INFO
  - After fix agent runs, immediately re-launch both judges before commit/push/done
  - Terminal states: `JUDGMENT: APPROVED` or `JUDGMENT: ESCALATED`
  - After 2 fix iterations with remaining issues, ask user whether to continue

### skill-creator
- **Trigger**: new skills, agent instructions, documenting AI usage patterns
- **Path**: `~/.config/opencode/skills/skill-creator/SKILL.md`
- **Rules**:
  - Follow `docs/skill-style-guide.md` as normative source before creating/updating
  - A skill = runtime instruction contract for an LLM, not human documentation
  - No `Keywords` section; preserve essential trigger words in `description`
  - References must point to local files
  - Target 180–450 body tokens; recommended max 700; hard max 1000

### work-unit-commits
- **Trigger**: implementation, commit splitting, chained PRs, keeping tests/docs with code
- **Path**: `~/.config/opencode/skills/work-unit-commits/SKILL.md`
- **Rules**:
  - Commit by work unit (deliverable behavior, fix, migration, or docs unit)
  - Do NOT commit by file type (no "models then services then tests")
  - Keep tests with the code they verify — same commit
  - Keep docs with the user-visible change they explain
  - Tell a story — reviewer must understand WHY each commit exists from its diff and message

## Project Convention Files Indexed

- `AGENTS.md` — project-level agent instructions covering architecture, quick start, env files, testing, endpoints, Docker, and gotchas
