import { describe, it, expect } from "vitest";
import { applyConfidenceGate } from "./confidence-gate.js";

const config = {
  productId: "test",
  referenceSourceId: "test-source",
  classificationPrompt: "test",
  model: "openai/gpt-4.1-mini",
  conservativeTier: "D" as const,
  confidenceThreshold: 0.6,
};

describe("applyConfidenceGate", () => {
  it("overrides to the conservative tier and flags for review below the confidence threshold", () => {
    const result = applyConfidenceGate(
      {
        class: "B",
        confidence: 0.4,
        rationale: "unsure",
        retrievedContextIds: [],
      },
      config,
    );
    expect(result).toEqual({ class: "D", needsReview: true });
  });

  it("passes through the LLM's tier unchanged at or above the confidence threshold", () => {
    const result = applyConfidenceGate(
      {
        class: "B",
        confidence: 0.75,
        rationale: "clear",
        retrievedContextIds: [],
      },
      config,
    );
    expect(result).toEqual({ class: "B", needsReview: false });
  });
});
