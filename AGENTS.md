# AGENTS.md

This is a standalone document classification service — read `README.md` first for what it is and
why. Notes specific to working on this codebase as an agentic worker:

- `NodeNext` module resolution is in effect (`tsconfig.json`) — all relative imports need explicit
  `.js` extensions even though the source files are `.ts`. Get this wrong and it only fails at
  build/run time, not in the editor.
- `src/classification/orchestrator.ts` is the only file that should know about PII detection, RAG
  classification, and the confidence gate together. Keep the other files independently testable
  and ignorant of each other.
- The eval harness (`eval/`) is a separate suite from `pnpm test` — it makes real LLM calls and
  isn't run in normal CI-speed test cycles. `eval/eval-stats.ts` contains the pure, unit-testable
  accuracy-computation logic; `eval/run-eval.ts` is the thin script wrapper — keep that split, don't
  merge pure logic back into the script.
- Any change to the `ClassificationResult` shape in `src/types.ts` should be checked against
  `rag-system`'s minimal `DocumentClassifier` interface spec (linked in README.md) for
  compatibility — this service's output is meant to satisfy that interface for future consumers.
