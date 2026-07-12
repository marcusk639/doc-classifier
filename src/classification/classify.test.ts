import { describe, it, expect, vi } from "vitest";
import { classifyDocument } from "./classify.js";
import * as ragClient from "../retrieval/rag-client.js";
import * as ai from "ai";

vi.mock("../retrieval/rag-client.js");
vi.mock("ai");

const config = {
  productId: "veteran-claims-app",
  referenceSourceId: "va-corpus",
  classificationPrompt:
    "Classify VA-disability-related documents by sensitivity.",
  model: "openai/gpt-4.1-mini",
  conservativeTier: "D" as const,
  confidenceThreshold: 0.6,
};

describe("classifyDocument", () => {
  it("grounds classification in retrieved context and returns structured output", async () => {
    vi.mocked(ragClient.retrieveContext).mockResolvedValue([
      {
        id: "chunk-1",
        text: "PTSD involves hypervigilance and avoidance.",
        sourceTitle: "PTSD Guide",
      },
    ]);
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        tier: "D",
        confidence: 0.92,
        rationale:
          "Mentions hypervigilance, matching the PTSD reference material.",
      },
    } as any);

    const result = await classifyDocument(
      "Patient reports hypervigilance and sleep disturbance.",
      config,
    );

    expect(result.class).toBe("D");
    expect(result.confidence).toBe(0.92);
    expect(result.retrievedContextIds).toEqual(["chunk-1"]);
    expect(ragClient.retrieveContext).toHaveBeenCalledWith(expect.any(String), [
      "va-corpus",
    ]);
  });
});
