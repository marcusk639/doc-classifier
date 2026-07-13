import { describe, it, expect, vi } from "vitest";
import { classifyDocument } from "./classify.js";
import * as ragClient from "../retrieval/rag-client.js";
import * as ai from "ai";

vi.mock("../retrieval/rag-client.js");
vi.mock("ai");

const config = {
  productId: "acme-corp",
  referenceSourceId: "acme-corp-kb",
  classificationPrompt: "Classify documents by sensitivity.",
  model: "openai/gpt-4.1-mini",
  conservativeTier: "D" as const,
  confidenceThreshold: 0.6,
};

describe("classifyDocument", () => {
  it("grounds classification in retrieved context and returns structured output", async () => {
    vi.mocked(ragClient.retrieveContext).mockResolvedValue([
      {
        id: "chunk-1",
        text: "Records containing a government-issued ID number are highly sensitive.",
        sourceTitle: "Sensitivity Reference Guide",
      },
    ]);
    vi.mocked(ai.generateObject).mockResolvedValue({
      object: {
        tier: "D",
        confidence: 0.92,
        rationale:
          "Mentions a government-issued ID number, matching the reference material.",
      },
    } as any);

    const result = await classifyDocument(
      "This record includes the applicant's government-issued ID number.",
      config,
    );

    expect(result.class).toBe("D");
    expect(result.confidence).toBe(0.92);
    expect(result.retrievedContextIds).toEqual(["chunk-1"]);
    expect(ragClient.retrieveContext).toHaveBeenCalledWith(expect.any(String), [
      "acme-corp-kb",
    ]);
  });
});
