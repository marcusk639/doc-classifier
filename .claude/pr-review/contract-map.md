# Contract map

"If X changes, check Y", per link type, both directions. Each `## <linkType>` heading matches one
`routing.json` entry. The map is guidance: confirm every link by reading both sides.

A path written `rag-system:<path>` is in the rag-system repository. In a review run it is at
`.review-external/rag-system/<path>`, checked out from rag-system's default branch at the SHA `facts.md`
reports under `external-counterpart`. If facts says it is unavailable, report the link as
"unverified (external)", at Medium at most.

## rag-search

- `src/retrieval/rag-client.ts` sends `POST /search` with `{query, sourceIds, topK}` and a bearer token, and
  reads `results[].text`, `results[].document.title`, `results[].chunk.id`.
- Other side: the route and its body schema in rag-system:apps/api/src/routes/search.ts (the `SearchBody`
  schema and the `/search` handler's `{ results }`), the result type `RetrievalResult` in
  rag-system:packages/core/src/types.ts and `SanitizedRetrievalResult` in
  rag-system:packages/core/src/metadata-policy.ts.
- Both directions: a renamed or moved field on either side, a new required body key, a `topK` above the
  route's limit, a changed auth scheme. `src/retrieval/rag-client.test.ts` mocks the response, so it does not
  prove the contract.
- Downstream here: `src/classification/classify.ts` uses the ids as `retrievedContextIds`.

## output-contract

- `ClassificationResultSchema` in `src/types.ts` is returned by `POST /classify` (`src/server.ts`) and as MCP
  `structuredContent` (`src/mcp/server.ts`).
- Other side: the `ClassificationResult` and `DocumentClassifier` interface in
  rag-system:docs/archive/specs/2026-07-11-generic-document-classification-engine-design.md §3.1. AGENTS.md
  requires this check on every shape change. Fields there (`class`, `handlingRules` and its four keys) must
  stay compatible; extra fields here are fine.
- The README cites this spec under an older path; see `doc-links`.

## presidio

- `src/pii/presidio-client.ts`: `PRESIDIO_URL` defaulting to port 5002, `POST /analyze` with
  `{text, language}`, reading `entity_type`, `start`, `end`, `score`.
- Other side: `docker-compose.yml` maps host 5002 to the analyzer's container port; the image tag floats (`latest`), so the
  analyzer's API can change without a commit here.
  A port change on one side fails only at runtime; the client test mocks `fetch`.
- Downstream: `src/classification/orchestrator.ts` forces the conservative tier on any finding (class 9).

## transport-parity

- `src/server.ts` (REST) and `src/mcp/server.ts` (MCP) are two entry points over the same orchestrator. Each
  validates `productId` with `PRODUCT_ID_PATTERN` from `src/config/product-config.ts`, loads config with
  `loadProductConfigById`, and returns a fixed message on failure.
- If either changes how it validates input, handles errors, loads config or shapes its output, check the
  other does the same, or that the difference is deliberate and said so. `facts.md` flags a PR that edits
  only one (`transport-pair`).

## product-config

- `ProductClassificationConfigSchema` in `src/config/product-config.ts`.
- Other side: `config/example.json.example`, `config/test.json`, the `.gitignore` allowlist for committed
  configs, the README setup step, and the inline config objects in `src/**/*.test.ts` (seven, in six test files).
- A new required key breaks every committed config and the eval at load time. A new committed config file is
  hidden by `.gitignore` unless allowlisted.

## env-vars

- Read in code: `CLASSIFIER_API_TOKEN` and `NODE_ENV` and `PORT` (`src/server.ts`), `PRODUCT_CONFIG_DIR`
  (three readers: `src/server.ts`, `src/mcp/server.ts`, `eval/run-eval.ts`), `RAG_API_URL` and
  `RAG_API_TOKEN` (`src/retrieval/rag-client.ts`), `PRESIDIO_URL` (`src/pii/presidio-client.ts`). The `ai`
  SDK reads its gateway key implicitly.
- Other side: the README's development commands, and whatever deploys the service (not in this repo).
- A rename in one reader, or a new variable the README does not mention, fails only at runtime.
  `facts.md` lists added and removed reads (`env-var-docs`).

## tier-order

- `DocumentClassSchema` (A to D) in `src/types.ts` is the tier vocabulary. Its order (A least, D most
  restrictive) is restated, not imported, in `eval/eval-stats.ts` and in the literal unions of
  `eval/run-eval.ts`; `conservativeTier` and the handling rules in
  `src/classification/orchestrator.ts` and `src/classification/confidence-gate.ts` depend on it.
- A change to the tier set, its order or what "conservative" means must reach every one of these, and
  `eval/golden-set.json`.

## golden-set

- `eval/golden-set.json` cases name a `productId`; `eval/run-eval.ts` loads its config from
  `PRODUCT_CONFIG_DIR` (default `./config`). The only committed config is `config/test.json`.
- Cases must stay synthetic (class 8) and generic (class 7).

## mcp-surface

- The `classify_document` tool's name, description and input schema in `src/mcp/server.ts`. External MCP
  clients depend on them; none live in this repo. A rename or schema change is a "check consumers" note,
  never a confirmed break.

## doc-links

- README.md and AGENTS.md cite rag-system design documents. The interface spec lives at
  rag-system:docs/archive/specs/2026-07-11-generic-document-classification-engine-design.md; the README's
  older `docs/superpowers/specs/` paths and the "vision" spec it names do not exist on rag-system's default
  branch.
- A PR that edits these links, or the architecture text around them, should leave them pointing at files
  that exist. Report a still-stale link only when the PR touches it (otherwise "Noticed nearby").

## module-resolution

- `tsconfig.json` uses `NodeNext`; AGENTS.md requires `.js` on every relative import. `facts.md` lists added
  relative imports without it (`nodenext-ext`).

## review-config

- `.claude/pr-review/**` and `.github/workflows/pr-review*.yml` are the reviewer itself (self-edit; see the
  kit's procedure).

<!-- pr-review:learned:begin -->
<!-- pr-review:learned:end -->
