import { describe, it, expect, vi } from "vitest";
import { classify } from "./orchestrator.js";
import * as presidio from "../pii/presidio-client.js";
import * as classifyModule from "./classify.js";

vi.mock("../pii/presidio-client.js");
vi.mock("./classify.js");

const config = {
  productId: "test",
  referenceSourceId: "test-source",
  classificationPrompt: "test",
  model: "openai/gpt-4.1-mini",
  conservativeTier: "D" as const,
  confidenceThreshold: 0.6,
};

describe("classify (orchestrator)", () => {
  it("forces the conservative tier when direct PII is found, even if the LLM classified it lower", async () => {
    vi.mocked(presidio.detectPii).mockResolvedValue([
      { entityType: "US_SSN", start: 0, end: 11, score: 0.9 },
    ]);
    vi.mocked(classifyModule.classifyDocument).mockResolvedValue({
      class: "B",
      confidence: 0.95,
      rationale: "General correspondence.",
      retrievedContextIds: [],
    });

    const result = await classify("123-45-6789 is my number", config);

    expect(result.class).toBe("D");
    expect(result.needsReview).toBe(true);
    expect(result.handlingRules.allowedAccessScope).toBe("single-source-only");
  });

  it("uses the LLM's tier when no PII is found and confidence is high", async () => {
    vi.mocked(presidio.detectPii).mockResolvedValue([]);
    vi.mocked(classifyModule.classifyDocument).mockResolvedValue({
      class: "B",
      confidence: 0.85,
      rationale: "General correspondence.",
      retrievedContextIds: ["chunk-1"],
    });

    const result = await classify("A routine status update.", config);

    expect(result.class).toBe("B");
    expect(result.needsReview).toBe(false);
    expect(result.handlingRules.allowedAccessScope).toBe("shared");
  });
});
