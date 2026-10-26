# doc-classifier: project brief for the PR reviewer

**Date:** 2026-10-26 · **Status:** phase 2 understanding, input to the draft spec
(`2026-10-26-pr-review-agent-design.md`) · **Base:** `origin/main` at `4e9df94`

This brief records what a repo-aware reviewer needs to know about doc-classifier. Every claim cites a
file and line on `origin/main`, a commit, or a PR. The repo is public, so this file describes link
patterns and invariants. It does not list weaknesses.

## 1. What it is and who uses it

A standalone service that takes a document's text and a `productId` and returns a sensitivity tier
(A–D), handling rules, a confidence score, a rationale and the ids of the reference chunks that informed
it (`src/types.ts:14-21`). It runs three layers: Presidio direct-identifier detection
(`src/pii/presidio-client.ts`), retrieval-grounded LLM classification against a product's reference
corpus in `rag-system` (`src/retrieval/rag-client.ts`, `src/classification/classify.ts`), and a
confidence gate (`src/classification/confidence-gate.ts`). The orchestrator combines them
(`src/classification/orchestrator.ts:19-55`). It is delivered over two transports, a Fastify REST API
(`src/server.ts:43`, `POST /classify`) and an MCP stdio server (`src/mcp/server.ts:86-91`, tool
`classify_document`), which call the same orchestrator (README.md:44-45).

**Users.** None yet. The README says consuming products adopt it later through a minimal interface, and
that nothing in the repo may name or embed a specific consumer (README.md:10-14, 28-30). Marcus is the
only author and the only collaborator (`gh api repos/marcusk639/doc-classifier/collaborators` returns
`marcusk639` only).

**What matters most.** The output is a security decision: the tier drives `handlingRules`, including
`allowedAccessScope` (`src/classification/orchestrator.ts:7-17, 32-35`). The design is
**fail-conservative**: any PII finding forces the conservative tier (`orchestrator.ts:30-31`), low
confidence forces it too (`confidence-gate.ts:8-10`), and under-classification is "the worst error type"
that fails the eval (`eval/run-eval.ts:38-47`, `eval/eval-stats.ts:22-27`). The rationale must explain
every override (`orchestrator.ts:37-45`, fixed in `24da866`).

## 2. Components and links

About 1,100 lines of TypeScript in 21 files (`src/`, `eval/`), plus `config/`, `docker-compose.yml`,
README and AGENTS.md. Imports are simple and one-directional; the orchestrator is the only module that
knows all three layers, by rule (AGENTS.md:9-11). Most of the coupling that can break silently is
**string-typed or cross-repo**:

| #   | Link                         | This side                                                                                                                                                                                                                                            | Other side                                                                                                                                                                                                                                                                                        | How a one-sided change fails                                                                                                                                                                            |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | rag-system search API        | `src/retrieval/rag-client.ts:5-11, 25-45` (`POST /search`, body `{query, sourceIds, topK}`, reads `results[].text`, `.document.title`, `.chunk.id`)                                                                                                  | rag-system `apps/api/src/routes/search.ts:19-23, 73-90`; result type `packages/core/src/types.ts:232` and `packages/core/src/metadata-policy.ts:130`                                                                                                                                              | Runtime `TypeError` or `undefined` ids. Unit tests mock `fetch` with a hand-written shape (`src/retrieval/rag-client.test.ts:14`), so they pass. Happened once: `1c8dd1d` (`r.chunkId` → `r.chunk.id`). |
| L2  | Output contract              | `ClassificationResultSchema` (`src/types.ts:14-21`), returned by REST (`src/server.ts:62`) and MCP `structuredContent` (`src/mcp/server.ts:65`)                                                                                                      | rag-system's `DocumentClassifier` interface spec, now at `rag-system/docs/archive/specs/2026-07-11-generic-document-classification-engine-design.md` §3.1 (AGENTS.md:16-18 requires the check)                                                                                                    | Future consumers break; nothing in this repo or CI compares the two.                                                                                                                                    |
| L3  | Presidio sidecar             | `src/pii/presidio-client.ts:3-4, 14-17, 26-32` (`PRESIDIO_URL` default `http://localhost:5002`, `POST /analyze`, snake_case fields)                                                                                                                  | `docker-compose.yml:3-5` (image `presidio-analyzer:latest`, port `5002:3000`)                                                                                                                                                                                                                     | Port or field rename fails at runtime only; tests mock `fetch`. The image tag floats (`latest`).                                                                                                        |
| L4  | Transport parity             | `src/server.ts:9-17, 43-69`                                                                                                                                                                                                                          | `src/mcp/server.ts:9-20, 22-82`                                                                                                                                                                                                                                                                   | A validation or error-handling fix lands on one transport only. Happened: `2412f56` (REST) then `97c642d` (MCP); `c828d4e` then centralised `PRODUCT_ID_PATTERN` in `src/config/product-config.ts:17`.  |
| L5  | Product config schema        | `ProductClassificationConfigSchema` (`src/config/product-config.ts:5-12`)                                                                                                                                                                            | `config/example.json.example`, `config/test.json`, `.gitignore:4-6` (allowlist), README.md:52, and 8 inline config literals in tests (`classify.test.ts:9`, `confidence-gate.test.ts:4`, `orchestrator.test.ts:9`, `product-config.test.ts:15`, `server.test.ts:16`, `mcp/server.test.ts:20, 80`) | A new required key makes every committed config and the eval fail to load; a new config file is silently gitignored unless allowlisted (`f216d1d` had to allowlist `config/test.json`).                 |
| L6  | Env-var names                | `CLASSIFIER_API_TOKEN`, `NODE_ENV` (`src/server.ts:21-24`), `PRODUCT_CONFIG_DIR` (`src/server.ts:22`, `src/mcp/server.ts:38`, `eval/run-eval.ts:21`), `RAG_API_URL`/`RAG_API_TOKEN` (`rag-client.ts:3, 18`), `PRESIDIO_URL`, `PORT` (`server.ts:77`) | README.md:49-56 dev commands; deployment environment (none committed). The `ai` SDK also reads its gateway key implicitly; no name appears in the repo.                                                                                                                                           | A rename in one of three `PRODUCT_CONFIG_DIR` sites, or in the README, fails only at runtime.                                                                                                           |
| L7  | Tier vocabulary and order    | `DocumentClassSchema` A–D (`src/types.ts:3`)                                                                                                                                                                                                         | `TIER_ORDER` and the literal unions in `eval/eval-stats.ts:1-5`, `eval/run-eval.ts:8`; `conservativeTier` semantics in `orchestrator.ts:30-35`; `expectedClass` in `eval/golden-set.json`                                                                                                         | The ordering is restated, not imported. Changing the tier set or its meaning in one place silently skews false-negative counting or handling rules.                                                     |
| L8  | Golden set ↔ product configs | `eval/golden-set.json` (`productId: "test"`)                                                                                                                                                                                                         | `config/test.json`; `loadProductConfigById` (`eval/run-eval.ts:20-23`)                                                                                                                                                                                                                            | Eval cannot run. Happened: `f216d1d`.                                                                                                                                                                   |
| L9  | MCP tool surface             | `classify_document` name, description and input schema (`src/mcp/server.ts:9-20, 86-91`)                                                                                                                                                             | External MCP clients (none in repo); README.md:44-45                                                                                                                                                                                                                                              | A rename or schema change breaks clients with no signal here.                                                                                                                                           |
| L10 | Document cross-references    | README.md:21-27 (two rag-system spec paths), AGENTS.md:3, 16-18                                                                                                                                                                                      | rag-system's docs tree                                                                                                                                                                                                                                                                            | Already drifted, see §4.                                                                                                                                                                                |
| L11 | Module resolution            | `tsconfig.json:4-5` (`NodeNext`); AGENTS.md:6-8                                                                                                                                                                                                      | Every relative import must end in `.js`                                                                                                                                                                                                                                                           | Vitest resolves it anyway, so tests pass; `tsc`/runtime fails. No CI runs `tsc` (§7).                                                                                                                   |

L1, L2 and L10 cross into `marcusk639/rag-system`, which is **public**, so a workflow can read its
default branch without a token.

## 3. Recurring bugs

The history is one build session (20 commits on 2026-07-11/12) and one later PR. Five fix commits and one
docs correction give these classes. Each is thin evidence; the spec treats them as hypotheses to confirm
with Marcus's feedback.

1. **Cross-repo contract drift (L1).** `1c8dd1d` "correct RAG search response shape to match
   rag-system's real API contract": the client read `r.chunkId`; the API returns `r.chunk.id`.
2. **A fix applied to one transport only (L4).** `2412f56` added productId validation and generic error
   bodies to REST; `97c642d` had to apply the same fix to MCP; `c828d4e` extracted the shared validator
   "to close duplication across 3 call sites".
3. **Untrusted request fields reaching the filesystem.** Same commits: `productId` was interpolated into
   a config path before the pattern check existed. Security class.
4. **Internal error detail returned to callers.** Same commits ("stop leaking internal errors"); the
   practised fix logs the full error server-side and returns a fixed message (`src/server.ts:63-67`,
   `src/mcp/server.ts:67-80`). Security class.
5. **Output that hides an override.** `24da866`: the rationale cited the PII override but not the
   confidence-gate override.
6. **Fixtures and committed config out of step with code (L5, L8).** `f216d1d`: the eval harness
   referenced a config the repo did not ship, and `.gitignore` had to allowlist it.
7. **Consumer identity leaking into a generic service.** `305902b` removed a named consumer from README,
   test fixtures and the MCP description example. A convention breach, and a privacy one when domain
   content comes with it.
8. **Unclear config error modes.** `babc75a`: malformed JSON produced an unclear error. Minor; folded into
   conventions rather than a class.

**No history yet** for: PII in logs, auth regressions, eval/golden-set regressions, prompt changes,
dependency or image upgrades, or anything from review comments (PR #1 has no comments).

## 4. Conventions as practised, and where docs and code disagree

Practised (all evidenced in `src/`):

- Zod at every boundary: request bodies (`src/server.ts:9-17`), MCP input (`src/mcp/server.ts:9-20`),
  config (`product-config.ts:5-12`), LLM output (`classify.ts:7-11`).
- Transports validate `productId` with the shared `PRODUCT_ID_PATTERN` and also re-check inside
  `loadProductConfigById` (`product-config.ts:55-63`): defence in depth, deliberate.
- Errors: log the full error server-side, return a fixed message; REST 400/404/502
  (`src/server.ts:44-68`), MCP `isError: true` (`src/mcp/server.ts:30-80`). Error messages include the
  file path for config errors (`product-config.ts:30-50`).
- Downstream clients throw on non-2xx with status only (`presidio-client.ts:20-24`, `rag-client.ts:34-38`).
- Tests sit beside sources as `*.test.ts`, mock module boundaries with `vi.mock`, and are TDD-shaped
  (`599ee78` adds a boundary test after the gate).
- Pure logic stays out of scripts: `eval/eval-stats.ts` vs `eval/run-eval.ts` (AGENTS.md:12-15).
- Conventional commit subjects (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), no scope. PR #1
  landed as a merge commit (`4e9df94`), not a squash, so commit subjects reach `main` as written.
- Generic placeholders (`acme-corp`, `test`) in fixtures and examples (`305902b`).

Docs vs code:

- README.md:21-22 cites `rag-system/docs/superpowers/specs/2026-07-11-future-generic-classification-service-vision.md`;
  no file with that name exists on rag-system `main`. README.md:27 cites
  `.../docs/superpowers/specs/2026-07-11-generic-document-classification-engine-design.md`; it now lives
  under `docs/archive/specs/`. AGENTS.md:16-18 depends on that link.
- README.md:37 says retrieval uses rag-system's `search_documents` API; the code calls the REST route
  `POST /search` (`rag-client.ts:25`). `search_documents` is rag-system's MCP tool name.
- README.md:49-56 documents `PRODUCT_CONFIG_DIR` and `RAG_API_TOKEN` only; `CLASSIFIER_API_TOKEN`,
  `RAG_API_URL`, `PRESIDIO_URL`, `PORT` and the gateway key are undocumented.
- README.md:38-39 says the LLM returns `{tier, confidence, rationale}`; that is the internal LLM schema
  (`classify.ts:7-11`), mapped to `class` in the public result (`classify.ts:32-37`). Accurate, but a
  reader can mistake it for the output contract.

## 5. Intentional, do not flag

- Unauthenticated `/classify` when `CLASSIFIER_API_TOKEN` is unset outside production, with a warning
  (`src/server.ts:24-33`); a single shared bearer token is MVP scope (README.md:64-65).
- Double validation of `productId` (transport plus loader).
- `config/test.json` committed with placeholder values (`f216d1d`); other `config/*.json` gitignored.
- The eval makes real LLM calls and is not part of `pnpm test` (AGENTS.md:12-15).
- The golden set is a three-case synthetic starter (`ab69a90` "synthetic starter golden set").
- No per-product prompts or knowledge bases in the repo (README.md:58-63).
- `acme-corp` placeholders.
- PII detection and LLM classification run in parallel (`orchestrator.ts:23-26`). Whether the raw text
  should reach the LLM when PII is present is a design question for Marcus, not a reviewer finding.

## 6. Sensitive material and visibility

- **Public repo.** PR comments, the hidden ledger and Actions logs are world-readable. Only `marcusk639`
  can push. Private vulnerability reporting is off (`.../private-vulnerability-reporting` →
  `{"enabled":false}`); draft repository security advisories remain available to the admin of a public
  repo and do not depend on that setting.
- **Secrets in scope:** `CLASSIFIER_API_TOKEN`, `RAG_API_TOKEN`, the AI Gateway key. None are committed;
  there is no secret scanning or push protection on the repo (`security_and_analysis` all disabled).
- **Data:** documents classified by this service may contain PII and regulated content by design. Test
  and golden-set text must stay synthetic (`eval/golden-set.json` uses a fake SSN). Logs may carry
  `productId` (`src/mcp/server.ts:44-47, 68-71`) but must never carry document text.
- **Security boundary:** the tier and handling rules are an access-control input for consumers, so a
  change that can make a result less restrictive is security-relevant even with no auth code touched.

## 7. Volume, size, CI and hooks

- **PRs:** 1 total, merged 2026-10-17 (+3 lines, 1 file). The 20 build commits went straight to `main`.
  No basis for sizing turn caps from history: **no history yet**.
- **CI:** none. No `.github/` directory; no workflows, no secrets (`gh secret list` empty). `pnpm test`
  (27 tests, 9 files, all passing locally on `4e9df94`) and `tsc --noEmit` (clean) run only when Marcus
  runs them. The reviewer cannot run them either (no shell), so nothing on a PR checks types, tests or
  the NodeNext `.js` rule.
- **Hooks:** none in the repo; no `.claude/`, no `.mcp.json`, no `CLAUDE.md`. No file-size rule.
- **Tooling trap:** with pnpm 12, any `pnpm` command in this repo rewrites `pnpm-lock.yaml` and creates
  `pnpm-workspace.yaml` (`ERR_PNPM_IGNORED_BUILDS` for esbuild). Local verification should call
  `node_modules/.bin/*` directly and must not commit those changes.

## 8. Corrections already given to reviewers or agents

None found. PR #1 has no comments or review comments. The commit history holds Marcus's own corrections
(`305902b`, consumer neutrality), which seed `conventions.md`, not learned memory.
