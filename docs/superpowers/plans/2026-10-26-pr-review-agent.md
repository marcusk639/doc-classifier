# doc-classifier PR reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Give doc-classifier an advisory, repo-aware PR reviewer that runs the shared `pr-review-kit` engine
with this repo's own knowledge, checks and learned memory.

**Status:** executed; amended at kit `be671da` (knowledge moved to `.pr-review/`, P5 and the consumer
external-checkout step replaced by the kit's `externalCheckouts`, `tiers.set: "none-light-full"`).

**Architecture:** The kit's `review` and `publish` composite actions, pinned by full SHA, run from
`.github/workflows/pr-review.yml`; the kit's `learn` and `propose` actions run weekly from
`.github/workflows/pr-review-learn.yml`. Everything project-specific lives under `.pr-review/` and is
read from the base branch. One consumer step checks out rag-system's default branch read-only as an external
counterpart.

**Tech Stack:** GitHub Actions, `pr-review-kit` (Node 22 built-ins only), `node:test` for the project checks.

**Spec:** `docs/superpowers/specs/2026-10-26-pr-review-agent-design.md` (evidence:
`docs/superpowers/specs/2026-10-26-pr-review-project-brief.md`).

## Global Constraints

- Kit: `~/dev/pr-review-kit`; dry runs use its current local HEAD; the workflows pin a full 40-hex SHA, the
  same in every `uses:` of the kit.
- `actions/checkout` pinned by full SHA in this repo's workflows.
- `config.json`: `project: "doc-classifier"`, `visibility: "public"`, `securityChannel: "advisory"`,
  `inline.max: 5`, `tiers.enabled: false` (until the kit offers `light` without the incremental tiers),
  `checks.newFileSize: false`, `checks.titleScope: false`, `trust.feedbackAuthors: ["marcusk639"]`.
- Security classes: 3, 4, 8, 9. Job `timeout-minutes: 15`.
- Knowledge holds patterns and counterpart paths only, never a list of current weaknesses. The latent issue
  reported privately at phase 2 stays out of every committed file.
- No consumer product names anywhere (class 7 applies to the reviewer's own files).
- External paths are written `rag-system:<path>`.
- Never run `pnpm` in the worktree (it rewrites `pnpm-lock.yaml`); use `node_modules/.bin/*`.
- Nothing is pushed; commits are local on `chore/pr-review`, conventional subjects.

## Review Focus

- A PR that adds `.review-external/` itself: the workflow must delete it before the trusted checkout.
- rag-system checkout fails: P5 must say "unavailable", and the run must continue.
- A check that throws on odd diff input (binary file, deleted file, rename): each project check is tested
  with a deleted file and a binary entry.
- Relative imports already ending in `.js`, or package imports: P1 must not fire on them.
- `process.env` reads in test files: P3 reports them like any other, the model decides.

---

### Task 1: Engine config, routing and knowledge

**Files:**

- Create: `.pr-review/config.json`, `routing.json`, `REVIEW.md`, `checklist.md`, `conventions.md`,
  `false-positives.md`, `contract-map.md`, `learned-lessons.md`, `learned/lessons.json`,
  `learned/precision.json`

- [ ] **Step 1:** Write `config.json` with the Global Constraints values and the 12 classes of spec §7.5
      (`always`: 7, 8, 11; `light`: 8, 11; `security`: 3, 4, 8, 9), `knowledge` listing the five markdown
      files, `checks.project: ["checks/doc-classifier.mjs"]`.
- [ ] **Step 2:** Write `routing.json`: one entry per link type L1–L11 (named `rag-search`, `output-contract`,
      `presidio`, `transport-parity`, `product-config`, `env-vars`, `tier-order`, `golden-set`,
      `mcp-surface`, `doc-links`, `module-resolution`) plus `review-config`, with spec §7.5 paths and classes.
- [ ] **Step 3:** Write the knowledge files from brief §2–§5; each link type gets exactly one `## <linkType>`
      section in `contract-map.md`; each class a `## <id>. ` heading in `checklist.md`; every file ends
      with an empty `pr-review:learned` block.
- [ ] **Step 4:** Write the addendum `REVIEW.md`: what the project is, the `rag-system:` path rule and the
      "unverified (external)" cap, the fail-conservative and transport-parity passes, severity calibration,
      "Features touched" is one line.
- [ ] **Step 5:** Run `node ~/dev/pr-review-kit/bin/pr-review.mjs validate` from the worktree. Expected:
      only "workflow missing" errors (Task 3 adds the workflows).
- [ ] **Step 6:** Commit `feat: add PR reviewer knowledge and engine config`.

### Task 2: Project checks P1–P5

**Files:**

- Create: `.pr-review/checks/doc-classifier.mjs`
- Test: `.pr-review/checks/test/doc-classifier.test.mjs`

**Interfaces:**

- Consumes: kit `runProjectChecks` contract: default export `[{ name, run(ctx) }]`, `ctx.files` =
  `[{file, oldFile, status, binary, added[{line,text}], removed[...]}]`, `ctx.repoRoot`; returns
  `[{file, line?, note}]`.
- Produces: checks named `nodenext-ext` (P1), `transport-pair` (P2), `env-var-docs` (P3), `config-schema`
  (P4), `external-counterpart` (P5).

- [ ] **Step 1: Write failing tests** (`node:test`, fixtures built in the test):
  - P1: added `import { x } from "./a";` in `src/a.ts` → one fact at its line; `"./a.js"`, `"zod"`, and the
    same line in a `.md` file → none.
  - P2: only `src/mcp/server.ts` changed → a fact naming `src/server.ts`; both changed → none.
  - P3: added `process.env.NEW_VAR` with `README.md` (in a temp repoRoot) lacking it → fact
    "not in README.md"; present → fact "documented"; removed reads → fact "no longer read".
  - P4: added line inside `ProductClassificationConfigSchema` in `src/config/product-config.ts` with no
    change to `config/test.json` or `config/example.json.example` → fact; with one of them changed → none.
  - P5: `.review-external/rag-system.sha` holding 40 hex → fact with that SHA; missing or malformed →
    fact "external counterparts unavailable".
  - Robustness: a deleted file entry and a `binary: true` entry produce no throw.
- [ ] **Step 2:** Run `node --test '.pr-review/checks/test/*.test.mjs'` → FAIL (module missing).
- [ ] **Step 3:** Implement `doc-classifier.mjs` (Node built-ins only).
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5:** Commit `feat: add doc-classifier project checks`.

### Task 3: Workflows

**Files:**

- Create: `.github/workflows/pr-review.yml`, `.github/workflows/pr-review-learn.yml`

- [ ] **Step 1:** `pr-review.yml` from the kit example: triggers, guards (drafts, forks, Dependabot),
      `timeout-minutes: 15`, permissions `contents: read`, `pull-requests: write`, `issues: read`,
      `id-token: write`; checkout PR head (SHA-pinned, `fetch-depth: 0`, `persist-credentials: false`);
      the external step (`rm -rf .review-external`, SHA-pinned sparse checkout of `marcusk639/rag-system`
      into `.review-external/rag-system` with `continue-on-error: true`, then write the `.sha` file and
      remove `.git`); kit `review` with the OAuth token only; kit `publish` with `if: always()`,
      `PR_REVIEW_ID_KEY` and `SECURITY_ADVISORY_TOKEN` only.
- [ ] **Step 2:** `pr-review-learn.yml` from the kit example, plus, in the learn job before the kit's learn
      action, nothing that holds a write token. Project checks for the learning PR follow whatever the kit's
      learn action exposes; if it exposes nothing, record that in the runbook as an open item.
- [ ] **Step 3:** Run `validate` → `validate: ok`; run `actionlint` on both files → clean.
- [ ] **Step 4:** Commit `ci: add PR review and learning workflows`.

### Task 4: Local dry runs

- [ ] **Step 1:** For `4ab8ba2` (class 1, the rag-system client that read `r.chunkId`), `b57f6c7` (class 2,
      the MCP tool added without the REST validation), and `c2bbe14` (PR #1), run
      `node ~/dev/pr-review-kit/bin/pr-review.mjs local --base <sha>^ --head <sha> --project .pr-review`
      with a fake `.review-external/rag-system.sha` present. Expected: routing names the right link types;
      P2 fires on `b57f6c7`; P5 reports the SHA.
- [ ] **Step 2:** Hand-write a `findings.json`/`summary.md` pair for `b57f6c7` with one class 2 finding and
      one class 9 security finding; run `local` with `--findings`/`--summary`. Expected: the security finding
      renders as a pointer only; the class 2 finding has a handle.
- [ ] **Step 3:** Record the results in the runbook.

### Task 5: Runbook and review

**Files:**

- Create: `docs/superpowers/plans/2026-10-26-pr-review-runbook.md`

- [ ] **Step 1:** Ordered GitHub steps (spec §7.10) and the acceptance checks of spec §8.
- [ ] **Step 2:** Run `code-reviewer` and `security-reviewer` on `git diff origin/main...HEAD`; fix confirmed
      Critical/High; commit.
