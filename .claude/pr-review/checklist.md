# Bug-class checklist

The recurring classes, mined from this repo's history (one build session and one PR, so the evidence is
thin) plus two from the design's own invariants. `routing.json` decides which classes a run applies;
classes marked `always` in `config.json` always apply. Evidence entries are history to learn from, not open
issues. Finding `class` numbers in `findings.json` use the numbers below.

## 1. Cross-repo contract drift with rag-system

- **Look for:** a change to what `src/retrieval/rag-client.ts` sends to or reads from rag-system's
  `POST /search`, or to `ClassificationResultSchema` in `src/types.ts`, that the rag-system side does not
  match. Open the rag-system side (`rag-system:` paths in `contract-map.md`) and cite it with its SHA from
  `facts.md`.
- **Trigger paths:** `src/retrieval/**`, `src/types.ts`.
- **Note:** the unit tests mock `fetch` with a hand-written response, so they pass whatever rag-system
  returns. A test change that only follows the code proves nothing about the contract.
- **Evidence:** `1c8dd1d` (client read `r.chunkId`; rag-system returns `r.chunk.id`).

## 2. Change applied to one transport only

- **Look for:** validation, error handling, response shape or config loading changed in
  `src/server.ts` or `src/mcp/server.ts` and not in the other. Shared logic belongs in
  `src/config/product-config.ts` or the orchestrator, not in either transport.
- **Trigger paths:** `src/server.ts`, `src/mcp/**`.
- **Evidence:** `2412f56` fixed REST; `97c642d` had to repeat the fix for MCP; `c828d4e` then shared the
  validator.

## 3. Request fields reaching the filesystem or a URL unvalidated

- **Look for:** a request or tool-input field used to build a path, file name or outbound URL without the
  shared pattern check, or a new loader that skips it.
- **Trigger paths:** `src/server.ts`, `src/mcp/**`, `src/config/**`.
- **Evidence:** `2412f56`, `97c642d` (security class: details go to the private channel).

## 4. Internal error detail returned to callers

- **Look for:** an error message, stack, downstream status body or file path returned in a REST response or
  MCP tool result instead of a fixed message. Logging the full error server-side is the convention.
- **Trigger paths:** `src/server.ts`, `src/mcp/**`, `src/retrieval/**`, `src/pii/**`.
- **Evidence:** `2412f56`, `97c642d` (security class).

## 5. Rationale or needsReview that hides an override

- **Look for:** a path where the final class differs from the LLM's class, or `needsReview` is set, and the
  rationale does not say why.
- **Trigger paths:** `src/classification/**`.
- **Evidence:** `24da866` (confidence-gate override missing from the rationale).

## 6. Committed configs, fixtures or golden set out of step with code

- **Look for:** a schema key added, renamed or made required without updating
  `config/example.json.example`, `config/test.json` and the inline configs in tests; a new committed config
  that `.gitignore` would hide; a golden case whose `productId` has no committed config; an env var read in
  code but missing from the README.
- **Trigger paths:** `src/config/**`, `config/**`, `.gitignore`, `eval/**`.
- **Evidence:** `f216d1d` (eval harness pointed at a config the repo did not ship).

## 7. Consumer identity or domain content in a generic repo

- **Look for:** a specific consuming product's name, a real customer or domain document, or domain prompt
  text in code, fixtures, examples, docs or descriptions. Use generic placeholders.
- **Trigger paths:** any.
- **Evidence:** `305902b` (a named consumer removed from README, fixtures and the MCP description).

## 8. Secrets, PII or document text in code, fixtures, logs or output

- **Look for:** committed tokens or keys; real-looking personal data in tests or the golden set; document
  text in a log call, an error message or the rationale beyond what the LLM wrote.
- **Trigger paths:** any.
- **Evidence:** no history yet.

## 9. Fail-conservative regression

- **Look for:** any path on which a result can come out less restrictive than before: the PII override
  skipped or conditional, the confidence gate weakened, a tier comparison or ordering restated instead of
  derived from `DocumentClassSchema`, handling rules that do not grow at least as strict as the tier, a
  default that falls back to a permissive tier on error. Describe the input that triggers it.
- **Trigger paths:** `src/classification/**`, `src/types.ts`, `src/pii/**`, `eval/**`.
- **Evidence:** no history yet. The invariant comes from README.md and `src/classification/orchestrator.ts`
  (security class).

## 10. Tests that cannot fail

- **Look for:** a test that mocks the very module or response shape the PR changes, so it would pass if the
  change were reverted; fixtures that only ever use the most restrictive tier as `conservativeTier`;
  assertions on the mock.
- **Trigger paths:** `**/*.test.ts`, and the code they cover.
- **Evidence:** no history yet. Every test mocks its module boundaries.

## 11. PR text or docs that claim what the code does not do

- **Look for:** a PR description, README or AGENTS.md statement the diff contradicts or leaves stale; links
  to rag-system documents that do not exist on its default branch.
- **Trigger paths:** any; `README.md`, `AGENTS.md`.
- **Evidence:** README cross-references to rag-system specs that have since moved (see `contract-map.md`,
  `doc-links`).

## 12. NodeNext relative import without .js

- **Look for:** a relative `import`/`export from` in a `.ts` file without the `.js` suffix. Vitest resolves
  it, so tests pass; `tsc` and Node fail. No CI runs `tsc`, so this reaches `main` unless reported.
- **Trigger paths:** `src/**/*.ts`, `eval/**/*.ts`.
- **Evidence:** AGENTS.md (the rule); no history of a breach yet.

<!-- pr-review:learned:begin -->
<!-- pr-review:learned:end -->
