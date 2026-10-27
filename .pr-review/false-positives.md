# Known-intentional patterns: do not flag

Each entry is deliberate and documented. Flag one only if the PR changes the reason it is safe, and then say
which reason changed.

## Local-development mode without a token

The REST server has a development mode with no token configured, and it must refuse to start in production
without one (README, "What's deliberately not in this repo yet": one shared bearer token is MVP scope). Don't
report the development mode itself. Do report any change to how production is detected or to the startup
refusal, and any new route or transport that does not apply the same token check.

## productId validated more than once

Each transport and the config loader check `PRODUCT_ID_PATTERN` (`conventions.md`). Defence in depth, not
duplication to remove.

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

## The existing parallel PII and LLM calls

Don't report the orchestrator's existing design of sending the document to Presidio and to the LLM at the same
time; it is an open product decision outside the reviewer's scope. This entry covers only that existing call.
Do report any change that widens what reaches the LLM or any other service (more text, metadata, identifiers,
a new destination or log), and any change to the PII override itself (classes 8 and 9).

## acme-corp and test placeholders

Generic names are the convention (class 7), not leftover fixtures.

<!-- pr-review:learned:begin -->
<!-- pr-review:learned:end -->
