import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleClassifyDocument } from "./server.js";
import * as orchestrator from "../classification/orchestrator.js";
import * as configModule from "../config/product-config.js";

vi.mock("../classification/orchestrator.js");
vi.mock("../config/product-config.js");

describe("handleClassifyDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(result.structuredContent?.class).toBe("B");
  });

  it("rejects a path-traversal productId without reaching the filesystem", async () => {
    const result = await handleClassifyDocument({
      documentText: "test doc",
      productId: "../../../../etc/passwd",
    });

    expect(result.isError).toBe(true);
    expect(configModule.loadProductConfig).not.toHaveBeenCalled();
  });

  it("returns a generic error and does not leak internal details when loadProductConfig throws", async () => {
    vi.mocked(configModule.loadProductConfig).mockImplementationOnce(() => {
      throw new Error(
        "Could not read product classification config at ./config/unknown.json",
      );
    });

    const result = await handleClassifyDocument({
      documentText: "test doc",
      productId: "unknown",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("./config");
  });

  it("returns a generic error and does not leak internal details when classify() throws", async () => {
    vi.mocked(configModule.loadProductConfig).mockReturnValue({
      productId: "test",
      referenceSourceId: "test-source",
      classificationPrompt: "test",
      model: "openai/gpt-4.1-mini",
      conservativeTier: "D",
      confidenceThreshold: 0.6,
    });
    vi.mocked(orchestrator.classify).mockRejectedValueOnce(
      new Error("Presidio sidecar unreachable: ECONNREFUSED 127.0.0.1:5001"),
    );

    const result = await handleClassifyDocument({
      documentText: "test doc",
      productId: "test",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("ECONNREFUSED");
  });
});
