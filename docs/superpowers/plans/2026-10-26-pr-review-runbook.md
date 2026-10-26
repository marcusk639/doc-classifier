# doc-classifier PR reviewer: GitHub runbook

**Date:** 2026-10-26 · **Spec:** `docs/superpowers/specs/2026-10-26-pr-review-agent-design.md` · **Plan:**
`docs/superpowers/plans/2026-10-26-pr-review-agent.md`

Every step below is visible outside this machine or hard to undo, so each waits for Marcus's explicit
approval. They run in order: the reviewer reads its knowledge and checks from the base branch, so nothing
reviews anything until step 2 has merged.

## 0. Before the skeleton PR

**Hard precondition for merging anything:** `marcusk639/pr-review-kit` is published on GitHub (public) and
contains kit commit `be671dacb924f94e455ab2448bfa97026beee3d8` on its `main`, which all four kit `uses:`
lines pin. Until then the workflows cannot resolve the action. If the kit has moved on, re-pin all four lines
to the commit the kit broadcasts, then run `node ~/dev/pr-review-kit/bin/pr-review.mjs validate` and
`actionlint` again.

## 1. Skeleton PR

- [ ] Push `chore/pr-review` and open a PR to `main` (title `ci: add advisory PR reviewer`). Merge commit, as
      PR #1 was.
- [ ] Expected on this PR: no review. The kit actions run, but the base branch has no `.pr-review/`, so
      facts yields tier `none` and publish posts nothing (no secrets are set yet either).
- [ ] Merge.

## 2. Secrets and settings (Marcus)

- [ ] `CLAUDE_CODE_OAUTH_TOKEN`: `gh secret set CLAUDE_CODE_OAUTH_TOKEN -R marcusk639/doc-classifier`.
- [ ] `PR_REVIEW_ID_KEY`: a random 32-byte hex value (`openssl rand -hex 32 | gh secret set PR_REVIEW_ID_KEY -R marcusk639/doc-classifier`).
- [ ] `SECURITY_ADVISORY_TOKEN`: Marcus creates a fine-grained PAT, resource owner `marcusk639`, repository
      access **only** `doc-classifier`, permission "Repository security advisories: Read and write", nothing
      else; then `gh secret set SECURITY_ADVISORY_TOKEN -R marcusk639/doc-classifier`.
- [ ] Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests" (for the
      learning PR).
- [ ] Leave private vulnerability reporting off; draft advisories do not need it (step 3 proves this).

## 3. Test PR

- [ ] Throwaway branch `test/pr-review-online` with a harmless README edit; open as ready (not draft).
- [ ] Check: a summary comment posted by `github-actions[bot]`; the job summary's status line; zero
      `permission_denied` entries; `## External counterparts` in the run's facts shows a rag-system SHA (job
      log line `externals: 1 of 1 checked out`); tier is `full`. Then push a second commit touching only
      `docs/`: tier `light`.
- [ ] Prove the advisory channel on one harmless planted test finding before any security replay: label the
      branch content "PLANTED TEST", confirm a draft advisory appears and the public summary shows only
      severity and area. Delete the advisory afterwards.
- [ ] Close the PR and delete the branch.

## 4. Replay PRs (throwaway branches, planted, clearly labelled)

Each branch starts from `main`, adds one planted bug with a `PLANTED FOR REVIEWER REPLAY` commit subject and PR
title prefix, and is closed unmerged. Expected result for each:

| #   | Branch                    | Planted change                                                                             | Expected                                                                                              |
| --- | ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1   | `replay/rag-field`        | `rag-client.ts` reads `r.chunkId` again (the `1c8dd1d` bug), test fixture updated to match | class 1 finding citing `rag-system:apps/api/src/routes/search.ts` or the core result type and its SHA |
| 2   | `replay/transport-parity` | a new validation rule added to `src/server.ts` only                                        | `transport-pair` fact; class 2 finding citing `src/mcp/server.ts`                                     |
| 3   | `replay/config-key`       | new required key in `ProductClassificationConfigSchema`, configs unchanged                 | `config-schema` fact; class 6 finding naming `config/test.json`                                       |
| 4   | `replay/pii-override`     | orchestrator skips the PII override on one path                                            | class 9 security: public pointer only; draft advisory with both sides                                 |
| 5   | `replay/nodenext`         | a relative import without `.js`                                                            | `nodenext-ext` fact; class 12 finding                                                                 |
| 6   | `replay/external-down`    | any of the above, with the rag-system checkout step pointed at a nonexistent path          | "external counterparts unavailable"; any rag-system link "unverified (external)", Medium at most      |

Also on one of these PRs: push a second commit fixing the finding (the finding resolves, nothing is
re-posted), then an empty push (tier `none`), then cancel a run mid-way and push again (no duplicate inline
comment).

## 5. Feedback round trip

- [ ] On replay PR 2 (or a fresh one), 👎 the class 2 inline comment and reply with a line starting
      `review:` that corrects it (for example, that the rule is intentionally REST-only, with a reason).
- [ ] Push another commit: the finding is not re-raised, and `facts.md` quotes the correction.
- [ ] Run "PR Review learning" by `workflow_dispatch`. Expected: one learning PR from `pr-review/learning`
      with a lesson scoped to `src/server.ts` and class 2, its source link and date, and the precision table.
      Repeat with a 👎 from another account (if one is available) and confirm it produces nothing.
- [ ] Review and merge the learning PR (it gets no CI and no reviewer exemption; the self-edit finding on it is
      expected if the reviewer runs).
- [ ] Open a new PR that would trigger the same finding; confirm the reviewer now follows the lesson.

## 6. Trial

- [ ] React 👍/👎 on every posted finding. With near-zero PR volume, run until about 15 findings are rated
      rather than for two weeks. Target: at least 70 % 👍 and no wrong Critical/High. Below target, tune the
      knowledge files and caps.
- [ ] Record turns used and duration for the first ten runs; set `tiers.maxTurns.full` to about 1.5× the
      observed maximum.

## Acceptance checks (spec §8)

1. Posts a summary (and inline where warranted) with zero permission denials (step 3).
2. Replay set 1–5 each flagged with the right other side (step 4).
3. A clean PR gets no Critical/High (step 3's README PR).
4. Hooks and MCP servers do not run (job log of step 3).
5. Drafts, forks and Dependabot skipped (open the step 3 PR as draft first: no run).
6. Finishes inside the turn and time caps; observed turns reported (step 6).
7. Tier behaviour with `tiers.set: "none-light-full"`: empty push → `none`, docs-only push → `light`, nothing re-posted, cancelled run
   causes no duplicate (step 4).
8. Planted security finding stays private in summary, ledger, inline and log (replay 4).
9. Trial target met (step 6).
10. Feedback round trip changes behaviour (step 5); unavailable external checkout handled (replay 6).

## Rollback

Disable "PR Review" in the Actions tab to silence it at once; revert the workflow commit to remove it. Posted
comments and draft advisories can be deleted. Rotate `PR_REVIEW_ID_KEY` and revoke the PAT if the repo is
retired.

## Local verification already done (2026-10-26, kit `be671da`)

- Project check tests: 13 pass (`node --test '.pr-review/checks/test/*.test.mjs'`).
- `node ~/dev/pr-review-kit/bin/pr-review.mjs validate`: ok. `actionlint`: clean on both workflows.
- Facts dry runs (`local --base <sha>^ --head <sha> --project .pr-review`):
  - `4ab8ba2` (introduced the class 1 bug fixed in `1c8dd1d`): link types `rag-search`, `env-vars`,
    `module-resolution`; the rag-search map entry points at rag-system's result type, which carries
    `chunk.id`, so the knowledge points at the other side of the bug. P3 flagged `RAG_API_URL` as
    undocumented in that commit's README.
  - `b57f6c7` (MCP tool added after the REST-only fix, the class 2 history): `transport-pair` fired; link
    types `transport-parity`, `mcp-surface`, `module-resolution`, `env-vars`.
  - `c2bbe14` (PR #1): link type `product-config` only; no facts.
  - `305902b` (consumer-neutrality cleanup, class 7): `doc-links` plus seven code link types; `transport-pair`
    fired (only the MCP description changed), a hint the model is expected to dismiss.
- External counterparts: the kit's `local` command does not run them, so `engine/externals.mjs` was run
  directly against this config: token-free sparse fetch from GitHub gave
  `marcusk639/rag-system@main → .pr-review-external/rag-system (aec6aef…)` with the four counterpart paths
  and no `.git`; `PR_REVIEW_EXTERNAL_LOCAL` gave "(local copy)"; a nonexistent repo gave `unavailable` and
  left nothing behind.
- Publish dry run on `b57f6c7` with hand-written findings: a lone class 2 High renders with handle `F-8fab4e`
  and one inline comment with its fingerprint; the footer states the `review:` rule. With a class 3 security
  finding in the same file, the security finding renders as a pointer, the class 2 finding is withheld
  ("touches a security-relevant file"); no planted detail string reached the output. Expected kit behaviour,
  noted in the kit's design as a trial issue: in a repo this small one security finding in a transport file
  hides every other finding in that file.
- Not verifiable locally: the `light` tier (needs prior state from a real run), posting, advisories, the
  learning loop against real reactions.
