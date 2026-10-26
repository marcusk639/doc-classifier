# Known-intentional patterns: do not flag

Each entry is deliberate and documented. Flag one only if the PR changes the reason it is safe, and then say
which reason changed.

## No authentication outside production when the token is unset

`src/server.ts` runs `/classify` without auth when `CLASSIFIER_API_TOKEN` is unset and `NODE_ENV` is not
`production`, with a warning, and refuses to start in production without it. A single shared bearer token is
MVP scope (README, "What's deliberately not in this repo yet"). Do flag a change that lets production start
without the token, or that weakens the check.

## productId validated in two places

Each transport and the config loader check `PRODUCT_ID_PATTERN`. Defence in depth, not duplication to remove.

## config/test.json committed with placeholder values

The eval and local runs need one committed config; `.gitignore` allowlists it and the example file. Real
product configs stay uncommitted.

## The eval is outside pnpm test and makes real LLM calls

By design (AGENTS.md). Don't ask for it to be mocked or added to the unit suite.

## The golden set is a three-case synthetic starter

It is a harness seed, not a benchmark. Don't report its size. Do report a case that is not synthetic or that
names a consumer.

## No per-product prompts or knowledge bases

Each consuming product supplies its own (README). Don't ask for real prompts in this repo.

## PII detection and LLM classification run in parallel on the full text

The orchestrator sends the document to Presidio and to the LLM at the same time. Whether text with detected
identifiers should reach the LLM is an open product decision, not a reviewer finding. Do report a change
that drops the PII override itself (class 9).

## acme-corp and test placeholders

Generic names are the convention (class 7), not leftover fixtures.

<!-- pr-review:learned:begin -->
<!-- pr-review:learned:end -->
