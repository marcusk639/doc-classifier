import { describe, it, expect, vi } from "vitest";
import { handleClassifyDocument } from "./server.js";
import * as orchestrator from "../classification/orchestrator.js";
import * as configModule from "../config/product-config.js";

vi.mock("../classification/orchestrator.js");
vi.mock("../config/product-config.js");

describe("handleClassifyDocument", () => {
  it("loads the product config and delegates to the classify orchestrator", async () => {
    vi.mocked(configModule.loadProductConfig).mockReturnValue({
      productId: "test",
      referenceSourceId: "test-source",
      classificationPrompt: "test",
      model: "openai/gpt-4.1-mini",
      conservativeTier: "D",
      confidenceThreshold: 0.6,
    });
    vi.mocked(orchestrator.classify).mockResolvedValue({
      class: "B",
      handlingRules: {
        allowedAccessScope: "shared",
        requiresContentScanning: false,
        permittedForIngestion: true,
      },
      rationale: "General document.",
      confidence: 0.9,
      retrievedContextIds: [],
      needsReview: false,
    });

    const result = await handleClassifyDocument({
      documentText: "test doc",
      productId: "test",
    });

    expect(orchestrator.classify).toHaveBeenCalledWith(
      "test doc",
      expect.objectContaining({ productId: "test" }),
    );
    expect(result.structuredContent.class).toBe("B");
  });
});
