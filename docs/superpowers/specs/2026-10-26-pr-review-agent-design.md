# Repo-aware PR reviewer for doc-classifier: design (draft)

**Date:** 2026-10-26 · **Status:** draft, awaiting the shared engine's interface and Marcus's checkpoint
answers · **Owner:** Marcus Klein · **Evidence:** `2026-10-26-pr-review-project-brief.md` (cited as
"brief §N")

Modelled on recovery-platform's `docs/superpowers/specs/2026-10-22-pr-review-agent-design.md` (cited as
"RP §N"). The engine comes from the shared `pr-review-kit` repository; this spec covers what
doc-classifier configures, adds or leaves out.

## 1. Intent

doc-classifier is small (about 1,100 lines, brief §2) and has one author and no CI (brief §7). Its risk
does not come from size. It comes from three things a generic reviewer does not know:

- **Most of its contracts cross a repo boundary or are plain strings.** The rag-system search API, the
  `DocumentClassifier` output contract and the doc links all live in `rag-system`; the Presidio port,
  env-var names, config keys and the tier order are strings (brief §2, L1–L11). Unit tests mock every one
  of them.
- **Its output is a security decision.** The tier drives access scope, and the design is fail-conservative
  (brief §1). A refactor that lets a result come out less restrictive breaks the product without failing
  a test.
- **Nothing runs on a PR.** No CI runs tests, `tsc` or the eval, so a missing `.js` import extension or a
  one-transport fix reaches `main` unchecked.

The reviewer's edge here is the cross-repo map, the fail-conservative invariant and transport parity.

## 2. Decisions inherited from recovery-platform (RP §2)

| Decision          | Here                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Effect on merging | Advisory only. Never blocks, never approves, never a required check.                        |
| Runtime           | `anthropics/claude-code-action@v1`, via the shared engine pinned to a commit SHA.           |
| Auth and model    | `CLAUDE_CODE_OAUTH_TOKEN` (Marcus's subscription), Opus. **Secret not yet set** (brief §7). |
| Security findings | Public pointer only; details to a draft repository security advisory (§7.7).                |
| Review frequency  | Every push, no duplicates, with a simpler tier set (§7.4).                                  |

## 3. Goals

- **G1. Cross-repo and string-link breaks.** For each link type a diff touches (brief §2), open the other
  side and cite both. For L1/L2/L10 the other side is rag-system's default branch (§7.3).
- **G2. Fail-conservative invariant.** Any change that can make a result less restrictive than before, or
  that drops an override from the rationale, is reported with the input that triggers it.
- **G3. Transport parity.** A change to validation, error handling or response shape on one transport is
  checked against the other.
- **G4. Repo-specific review.** Apply the brief §3 classes and the brief §4 conventions, honouring brief §5.
- **G5. Stand-in for missing CI, within limits.** Flag what CI would have caught and the model can see in
  text: NodeNext `.js` extensions, tests that cannot fail, fixtures and configs out of step with schemas.
  The reviewer does not claim tests or types pass.
- **G6. Signal over volume.** On a repo this size, most PRs should produce zero to two findings.

## 4. Non-goals

- Running the PR's code, tests, `tsc` or the eval (RP §4). A small CI job for `tsc` and `vitest` is a
  separate follow-up (§11), not part of this reviewer.
- Reviewing forks or Dependabot PRs.
- Judging the classification quality of prompts or golden-set labels. The reviewer checks that a golden
  case stays synthetic and loadable, not whether its expected tier is right.

## 5. Anti-goals

Kept from RP §5: noise, confident wrong claims, leaking sensitive data in public, duplicate results, a
committed vulnerability catalogue, a PR editing its own rules, unbounded spend. Added here:

- **Naming a consumer.** A finding, a knowledge file or a learned lesson that names a specific consuming
  product breaks the repo's own neutrality rule (brief §3 class 7). Knowledge files use placeholders.
- **Claiming a cross-repo break from memory.** If the rag-system counterpart could not be read in this
  run, the finding says "unverified (external)" and is Medium at most.

## 6. Constraints

- Public repo; one collaborator (`marcusk639`); no workflows, no secrets yet (brief §6, §7).
- No `.claude/`, `.mcp.json`, `CLAUDE.md` or hooks in the repo. The engine's `disableAllHooks` and
  `--strict-mcp-config` stay on anyway: they cost nothing and keep a PR that adds either from affecting
  the run.
- Facts scripts use Node built-ins only and read the diff as text; nothing installs the PR's dependencies.
- Repo rules for the reviewer's own changes: conventional commits, no file-size rule, NodeNext `.js`
  imports if any TypeScript is added (none expected; engine and checks are `.mjs`).
- Local verification must not run `pnpm` (brief §7, tooling trap); use `node_modules/.bin`.

## 7. Design

### 7.1 Workflow

The consumer workflow calls the engine at a pinned SHA, in whatever form the engine settles on. Settings
specific to this repo:

- Triggers `opened`, `synchronize`, `ready_for_review`, `reopened`; skip drafts; same-repo guard; skip
  `dependabot[bot]`. **Dropped:** the `e2e-fix/*` guard (no such branches here).
- Concurrency per PR, cancel in progress (unchanged).
- `timeout-minutes: 15` (RP uses 30). The repo fits in one read; a run that needs 15 minutes is a sign of
  a loop, not of size. Tune after the first real runs.
- An extra read-only step checks out `marcusk639/rag-system` at its default branch into
  `.review-external/rag-system`, sparse, with `persist-credentials: false` and no token (§7.3).

### 7.2 Knowledge files (`.claude/pr-review/`)

| File                                    | Contents                                                                                                                                                                    | vs recovery-platform                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `REVIEW-addendum.md`                    | Project paths, the external-counterpart rule (§7.3), the fail-conservative pass, the transport-parity pass, the consumer-neutrality rule. Appended to the engine procedure. | **Adapted.** RP's `REVIEW.md` is the whole procedure; here the engine owns the generic part. |
| `contract-map.md`                       | L1–L11 from brief §2 as "if X changes, check Y", both directions, with counterpart paths.                                                                                   | **Adapted.** One file of about 11 entries instead of three per-product maps.                 |
| `checklist.md`                          | Classes from brief §3 plus two from design invariants (§7.5), each with triggers and evidence, or "no history yet".                                                         | Same shape.                                                                                  |
| `conventions.md`                        | Brief §4 as practised, linking AGENTS.md rather than copying it.                                                                                                            | Same shape.                                                                                  |
| `false-positives.md`                    | Brief §5.                                                                                                                                                                   | Same shape.                                                                                  |
| `routing.json`                          | Paths → link types → classes, in the engine's schema.                                                                                                                       | Same role; about 10 entries.                                                                 |
| `learned.md`                            | Learned lessons that fit no other file. Seeded empty: no corrections in history (brief §8).                                                                                 | **New** (feedback learning).                                                                 |
| `feedback-stats.json` (name per engine) | 👍/👎 counts per class and link type. Seeded empty.                                                                                                                         | **New.**                                                                                     |

On every tier the model reads all knowledge files in full. They total a few hundred lines, so RP's
"grep the heading, read the section" rule is dropped.

Every map entry is re-verified against `origin/main` (and rag-system `main` for external entries) when
written. Entries carry patterns and paths, never a list of current weaknesses.

### 7.3 External counterparts (rag-system)

L1, L2 and L10 cannot be checked from this repo alone, and L1 has already broken once (`1c8dd1d`).
rag-system is public, so the workflow can read it without a credential:

- A sparse checkout of `marcusk639/rag-system` default branch, limited to the counterpart paths in the
  map (`apps/api/src/routes/search.ts`, `packages/core/src/types.ts`,
  `packages/core/src/metadata-policy.ts`, `docs/archive/specs/`), into `.review-external/rag-system`.
- The model reads it like any other path. The facts file records the rag-system SHA used, so a finding
  cites a fixed version.
- Trust: the checkout is Marcus's own repo's default branch, chosen by the base-branch workflow, never by
  the PR. It is data for the model, never executed.
- If the checkout fails, facts says "external counterparts unavailable" and §5's "unverified (external)"
  rule applies. The run continues.
- Links that are external **without** a readable counterpart (MCP clients for L9, deployment env for L6)
  are reported as "check consumers" notes at Low or in map maintenance, never as breaks.

This needs an engine extension point (§9, E5). If the engine does not offer one, the fallback is the
"unverified (external)" rule alone, which loses most of G1's value for L1.

### 7.4 Every push, without duplication

**Adopted:** the summary comment with its hidden ledger, fingerprinted findings, acknowledged slugs,
superseded-head detection, and "a failed run never looks clean". These carry the no-duplicate and
honest-failure principles, and the engine provides them.

**Tiers: simplified.** RP's six tiers exist because one recovery-platform PR can be 5k lines across four
products. Here the whole repo is smaller than an average RP PR, and there is one PR in the repo's history.

| Tier    | When                                                                                            | Turn cap (starting) |
| ------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| `none`  | Empty increment since the last reviewed SHA, or engine scripts not on base yet.                 | 0                   |
| `light` | Increment is only docs, lockfile or `.gitignore`, and touches no link type (L10 counts as one). | 10                  |
| `full`  | Everything else: review the whole PR diff, deduplicated against the ledger and inline markers.  | 30                  |

**Dropped:** `incremental`, `incremental-new-links` and `base-drift`. Re-reviewing the whole PR on each
push costs a few turns here and removes a class of "the increment missed context" errors. Base drift
matters little with one author, and the cross-repo drift that does matter (rag-system) is not caught by a
base-branch diff anyway. The engine must support a reduced tier set (§9, E2).

Caps are guesses: **no history yet**. The first ten runs record turns used and duration; the caps are then
set to about 1.5× the observed maximum.

### 7.5 Bug classes and routing

From brief §3 (history) and brief §1 (design invariants). Classes 9 and 10 are not from history; they are
marked so in the checklist.

| #   | Class                                                                                                                                                                 | Evidence                                          | Security?                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| 1   | Cross-repo contract drift (rag-system search, `DocumentClassifier`, doc links)                                                                                        | `1c8dd1d`; README drift                           | no                                           |
| 2   | Fix or behaviour change on one transport only                                                                                                                         | `2412f56` → `97c642d`, `c828d4e`                  | no (yes if the change is validation or auth) |
| 3   | Request fields reaching the filesystem or a URL without validation                                                                                                    | `2412f56`, `97c642d`                              | yes                                          |
| 4   | Internal error detail returned to callers                                                                                                                             | `2412f56`, `97c642d`                              | yes                                          |
| 5   | Rationale or `needsReview` that hides an override                                                                                                                     | `24da866`                                         | no                                           |
| 6   | Committed configs, fixtures, golden set or `.gitignore` out of step with code                                                                                         | `f216d1d`                                         | no                                           |
| 7   | Consumer identity or domain content in a generic repo                                                                                                                 | `305902b`                                         | no                                           |
| 8   | Secrets, PII or document text in code, fixtures, logs or posted text                                                                                                  | no history yet                                    | yes                                          |
| 9   | Fail-conservative regression: a path where a result can become less restrictive, a tier-order assumption restated instead of shared, a threshold or override weakened | no history yet (design invariant, brief §1)       | yes                                          |
| 10  | Tests that can't fail: mocks that hide the contract under change, fixtures production never produces                                                                  | no history yet (all tests mock module boundaries) | no                                           |
| 11  | PR text or docs that claim what the code doesn't do                                                                                                                   | README drift, brief §4                            | no                                           |
| 12  | NodeNext import without `.js`                                                                                                                                         | AGENTS.md:6-8; no CI catches it                   | no                                           |

Routing (paths → classes):

| Paths                                      | Link types | Classes    |
| ------------------------------------------ | ---------- | ---------- |
| `src/retrieval/**`                         | L1         | 1, 4, 10   |
| `src/types.ts`                             | L2, L7     | 1, 9       |
| `src/pii/**`, `docker-compose.yml`         | L3         | 8, 9, 10   |
| `src/server.ts`, `src/mcp/**`              | L4, L6, L9 | 2, 3, 4, 8 |
| `src/config/**`, `config/**`, `.gitignore` | L5, L8     | 3, 6       |
| `src/classification/**`                    | L7         | 5, 9, 10   |
| `eval/**`                                  | L7, L8     | 6, 8, 9    |
| `README.md`, `AGENTS.md`, `docs/**`        | L10        | 7, 11      |
| any `*.ts`                                 | L11        | 12         |
| any                                        | —          | 7, 8, 11   |

### 7.6 Deterministic pre-checks

Engine generics, enabled: changed files grouped by area, link types triggered, secret-pattern scan of
added lines (redacted), PII-in-log heuristic on added `console.*`/`*.log.*` calls, test-tamper heuristics
(deleted tests, added `.skip`/`.only`, test-count drop), commit subjects.

Engine generics, disabled: the 300-line file rule (no such rule here), PR-title conventional-commit check
(PRs merge as merge commits, so the commit subjects matter, not the title; only one data point).

Project checks (through the engine's check hook, §9 E4), each a hint the model confirms:

- **P1. NodeNext extensions.** Added relative `import`/`export ... from "./x"` in `.ts` files without a
  `.js` suffix.
- **P2. Pair edits.** One of `src/server.ts` / `src/mcp/server.ts` changed and the other not (engine
  "duplicate pair" generic, if it exists).
- **P3. Env-var drift.** `process.env.NAME` added or removed in the diff, and whether `NAME` appears in
  `README.md`.
- **P4. Config schema without configs.** `src/config/product-config.ts` schema lines changed with no
  change to `config/example.json.example` or `config/test.json`.
- **P5. External counterpart SHA.** The rag-system SHA read, or "unavailable".

Not a check: consumer-name scanning. A deterministic denylist would have to commit the consumer names it
forbids, which breaks the rule it enforces. The model applies class 7 by judgement.

Pre-check failures never fail the job (RP §7.4).

### 7.7 Security findings

**Adopted unchanged.** The repo is public, as recovery-platform is, so the public-pointer rule and the
draft-advisory channel apply as written in RP §7.9: pointer with severity and area only, details in a
draft repository security advisory, deduplicated repo-wide, created by the model-free publish step with a
fine-grained PAT (`SECURITY_ADVISORY_TOKEN`, this repo only, "Repository security advisories: read and
write"), and opaque ledger ids keyed with `PR_REVIEW_ID_KEY`.

Security classes here: 3, 4, 8, 9, and 2 when the parity gap is validation or auth (§7.5). Class 9 is
the one that differs from RP: a fail-conservative regression has no auth code in it, but it changes who
may access a document downstream. **Open question Q3.**

Draft advisories on a public repo do not need private vulnerability reporting (currently off); the
skeleton run proves this before relying on it.

### 7.8 Output

Adopted from RP §7.7, with these changes:

- Summary sections: drop **Features touched** as a separate heading (there is one feature,
  classification); keep **Cross-repo and link impact** (link → other side → ok / broken / unverified
  (external)), **Findings**, **Checked and fine**, **Not reviewed / limits**, **Map maintenance**.
- Inline comments: Critical/High non-security only, **cap 5** per run (RP: 10). Any more on a 1k-line repo
  is noise.
- Per-finding feedback attribution follows the engine's design (see §8).

### 7.9 Feedback learning

Adopted from the engine as specified in the rollout brief, configured as:

- **Trusted authors:** `marcusk639` only (sole collaborator). Everyone else, including the bot, is
  ignored. Public repo: any stranger can react, so this setting is load-bearing.
- **Seed:** `learned.md` and the stats file empty; no corrections in history (brief §8).
- **Cadence:** the engine default. With PR volume near zero, a weekly scheduled learning run will usually
  find nothing; it must then exit without opening or touching a PR.
- **Merge policy:** every lesson via the learning PR for Marcus's review, unless the checkpoint decides
  otherwise (Q4).
- **Security narrowing:** any lesson that narrows classes 3, 4, 8 or 9 is flagged in the learning PR.
- **Neutrality:** lessons are rewritten without consumer names before they are proposed (class 7).

### 7.10 Delivery order and rollback

RP §7.10 and its "order of testing" apply unchanged: the PR that adds `.claude/pr-review/` and the
workflow is reviewed without them, so it merges first. Then secrets (`CLAUDE_CODE_OAUTH_TOKEN`,
`PR_REVIEW_ID_KEY`, `SECURITY_ADVISORY_TOKEN`), a test PR, replay PRs, a feedback round trip, and the
trial. Rollback is reverting the workflow or disabling it in the Actions tab.

Replay set (throwaway branches, clearly labelled, fake weaknesses only):

1. rag-system response field renamed in `rag-client.ts` only (class 1, `1c8dd1d`).
2. A new validation rule added to `src/server.ts` only (class 2, `2412f56`/`97c642d`).
3. A new required key in `ProductClassificationConfigSchema` with configs unchanged (class 6, `f216d1d`).
4. An orchestrator change that lets the PII override be skipped on one path (class 9; security channel).
5. A relative import without `.js` (class 12).

## 8. Acceptance criteria

From RP §8, applicable here: 1 (posts, zero permission denials), 2 (replay set above, each with the
correct other side; #1 must cite the rag-system file), 3 (a clean PR gets no Critical/High), 4 (hooks
and MCP servers don't run), 5 (drafts, forks and Dependabot skipped), 6 (finishes inside caps; report
observed turns), 7 adapted to the reduced tiers (a docs-only push runs `light`, an empty push runs
`none`, nothing is re-posted, a cancelled run causes no duplicate), 8 (planted security finding stays
private), 9 (trial: 👍/👎 on every finding, ≥ 70 % 👍, no wrong Critical/High). With near-zero PR volume a
two-week trial may see no PRs; the trial runs until about 15 findings have been rated instead.

Added: the feedback round trip from the rollout brief, and one run where the rag-system checkout is made
to fail, to confirm the "unverified (external)" path.

## 9. What this project needs from the engine

| #   | Configuration point or hook                                                                                                                                                 | Why                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| E1  | Knowledge paths and procedure addendum: engine `REVIEW.md` plus a project addendum file                                                                                     | §7.2; the generic procedure must not name RP's maps.           |
| E2  | Tier set and per-tier turn caps as config; allow `none`/`light`/`full` only, with "light" path patterns configurable                                                        | §7.4                                                           |
| E3  | Routing schema: path globs → link types → classes, read by facts                                                                                                            | §7.5                                                           |
| E4  | Project check hook: extra `.mjs` modules in `.claude/pr-review/checks/` loaded from base, receiving the parsed diff and file list, returning facts lines; failures isolated | P1–P4                                                          |
| E5  | External counterpart checkout: `{repo, ref, sparse paths, dir}` list, public repos without a token, SHA recorded in facts, failure → "unavailable" fact                     | §7.3; the main value for L1/L2/L10                             |
| E6  | Toggle each generic check (file-size rule and its limit, PR-title check, test-tamper heuristics, secret patterns extendable)                                                | §7.6                                                           |
| E7  | Security class list and "security area" names as config, used by the ledger, inline guard and advisory channel                                                              | §7.7                                                           |
| E8  | Inline comment cap and eligible severities as config                                                                                                                        | §7.8 (cap 5)                                                   |
| E9  | Summary section toggles (Features touched off; impact table title)                                                                                                          | §7.8                                                           |
| E10 | Visibility flag (`public`) driving the "everything is world-readable" text in the procedure                                                                                 | Public here; the engine must not hard-code it either way.      |
| E11 | Trusted feedback authors list; learning cadence; "no-op when nothing new" behaviour; security-class list for narrowing flags                                                | §7.9                                                           |
| E12 | Branch guards as config (`e2e-fix/*` off, Dependabot on, drafts skipped)                                                                                                    | §7.1                                                           |
| E13 | Job timeout as consumer-workflow input                                                                                                                                      | §7.1 (15 min)                                                  |
| E14 | Dry-run publish against a local diff, with the external checkout pointed at a local path                                                                                    | Local verification of P1–P5 and L1 against historical commits. |

## 10. Calls made by Claude (please check)

- Three tiers instead of six; whole-PR review on every non-trivial push.
- One contract map; all knowledge read in full each run.
- Read rag-system's default branch as an external counterpart, sparse and token-free.
- Inline cap 5; timeout 15 minutes; turn caps 10/30 pending real runs.
- Class 9 (fail-conservative regression) treated as security.
- No consumer-name denylist; class 7 by judgement.
- Trial measured by rated findings, not calendar time.

## 11. Follow-ups outside this project

- A CI job running `tsc --noEmit` and `vitest run` on PRs. It would catch class 12 and part of class 6
  deterministically, and let the reviewer drop P1.
- Fix the README's rag-system spec links and the `search_documents` wording; document all env vars.
- A contract fixture shared with rag-system for the `/search` response, so L1 drift fails a test.
- Pin the Presidio image instead of `latest`.
- Add a `packageManager` field (or document the pnpm 12 behaviour) so installs stop rewriting the lockfile.

## 12. Open questions for Marcus

- **Q1.** Is reading rag-system's default branch as an external counterpart acceptable (§7.3)? It is
  public and read-only, but it ties this reviewer to rag-system's file layout.
- **Q2.** Three tiers (`none`/`light`/`full`) instead of six (§7.4)?
- **Q3.** Should fail-conservative regressions (class 9) go through the private security channel, or be
  posted publicly in full, since the PR's own diff already shows them?
- **Q4.** May any lesson merge without your review (for example an explicit correction from you scoped
  to one path), or does every lesson go through the learning PR?
- **Q5.** Should the raw document text reach the LLM when Presidio has already found direct identifiers
  (brief §5, last item)? This decides whether the reviewer treats such a change as intentional.
- **Q6.** Is a small CI job for `tsc` and `vitest` in scope now (§11)? If yes, P1 can be dropped.
