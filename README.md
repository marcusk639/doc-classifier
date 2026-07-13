# doc-classifier

A standalone document classification service: given a document's text, returns a sensitivity
tier, a confidence score, and a human-readable rationale citing what reference material informed
the decision — using direct-identifier pattern detection (Microsoft Presidio) plus retrieval-
augmented, LLM-grounded semantic classification.

## Why this exists

Built to serve multiple, genuinely different products (e.g. a tax-compliance document set, a
health-and-benefits-claims document set) without embedding any single product's domain knowledge
in this repo. Each product supplies its own configuration (a reference knowledge base already
ingested in `rag-system`, plus a classification prompt) — this repo only ships the classification
_mechanism_.

## Full design context

This repo implements a design originally specified elsewhere. Read these before making
architectural changes:

- `rag-system/docs/superpowers/specs/2026-07-11-future-generic-classification-service-vision.md`
  — the full design, including a dedicated build-vs-adopt research pass (§1.1) that concluded no
  existing product does this end-to-end, but Presidio should be adopted for the PII layer and the
  "Contextual Policy Engine" academic paper (arXiv 2508.06204) validates the retrieve→ground→
  structured-output architecture pattern used here (with real caveats — single-domain, vendor-
  authored preprint; this service's own eval harness is what actually validates _this_ use case).
- `rag-system/docs/superpowers/specs/2026-07-11-generic-document-classification-engine-design.md`
  — the minimal interface consuming products implement to adopt this service later. Nothing in
  this repo requires any consumer to change anything now, and this repo never names or embeds a
  specific consumer's identity or domain content.

## Architecture

1. **PII layer** (`src/pii/`): calls a self-hosted Presidio sidecar (Docker) for direct-identifier
   detection (SSN, DOB, etc.).
2. **RAG classification core** (`src/retrieval/`, `src/classification/classify.ts`): retrieves
   grounding context from an existing `rag-system` deployment's `search_documents` API, then calls
   an LLM (via the AI Gateway) with a per-product prompt to produce a structured
   `{tier, confidence, rationale}`.
3. **Confidence gate** (`src/classification/confidence-gate.ts`): below a per-product threshold,
   overrides to the conservative tier and flags for human review.
4. **Orchestrator** (`src/classification/orchestrator.ts`): combines all three — any PII finding
   also forces the conservative tier, regardless of the LLM's semantic conclusion.
5. **Delivery**: a Fastify REST API (`src/server.ts`) and an MCP server (`src/mcp/`) both call the
   same orchestrator — one core implementation, two transports.

## Development

```bash
pnpm install
docker compose up -d          # starts the Presidio sidecar
cp config/example.json.example config/test.json  # edit with real values
PRODUCT_CONFIG_DIR=./config RAG_API_TOKEN=<token> pnpm dev
pnpm test
pnpm eval                     # runs the golden-set evaluation harness
```

## What's deliberately not in this repo yet

- Real per-product classification prompts/knowledge bases for any specific product — those are
  each consuming product's own task when they choose to adopt this service.
- Bootstrapping tooling for auto-ingesting regulatory text into a new domain's knowledge base
  (the vision spec's §2.4 describes this; not built in this initial plan).
- Multi-principal auth (this service uses a single shared bearer token for now, matching MVP scope
  — see `src/server.ts`).
