# Practised conventions

What the code actually does, so a PR that departs from it needs a reason. The repo's `AGENTS.md` is the
source of truth for its rules (NodeNext `.js` imports, the orchestrator as the only module that knows all
three layers, pure eval logic kept out of the script, the output-contract check); this file records only
what it leaves out and where docs and code disagree.

## Code

- Zod validates every boundary: request bodies (`src/server.ts`), MCP tool input (`src/mcp/server.ts`),
  product config (`src/config/product-config.ts`) and the LLM's structured output
  (`src/classification/classify.ts`).
- `productId` is validated more than once on purpose: REST checks it in its request schema, MCP in its tool
  input schema and again at the top of the handler, and `loadProductConfigById` checks it once more.
- Errors, REST (`src/server.ts`): 400 returns the request-schema validation message; 404 returns a fixed
  "Unknown productId" text and logs nothing; 502 logs the error and returns a fixed text.
- Errors, MCP (`src/mcp/server.ts`): config-load and classification failures are both logged to stderr with
  the `productId` and returned as `isError: true` with a fixed text; an invalid `productId` is echoed back.
- Neither transport returns a stack, a downstream body or a file path.
- Config load errors name the file path and say which of read / JSON / schema failed.
- Downstream clients throw on non-2xx with the status only, never the response body.
- Shared logic is extracted rather than copied between the two transports.

## Tests

- `*.test.ts` sits beside its source and uses Vitest with `vi.mock` at module boundaries.
- Boundary behaviour gets its own test (the exact-threshold case for the confidence gate).
- The eval (`pnpm eval`) makes real LLM calls and is not part of `pnpm test`.

## Content

- Fixtures and examples use generic placeholders (`acme-corp`, `test`) and synthetic documents. No consuming
  product is named anywhere.

## Commits and PRs

- Conventional subjects without a scope (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`). PRs have
  landed as merge commits, so each commit subject reaches `main` as written.

## Where docs and code disagree

- README says retrieval uses rag-system's `search_documents` API; the code calls the REST route `/search`
  (`search_documents` is rag-system's MCP tool).
- README documents only `PRODUCT_CONFIG_DIR` and `RAG_API_TOKEN`; the other variables in `contract-map.md`
  (`env-vars`) are undocumented.
- README's rag-system spec links point at paths that moved (`contract-map.md`, `doc-links`).

<!-- pr-review:learned:begin -->
<!-- pr-review:learned:end -->
