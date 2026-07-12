import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildServer } from "./server.js";
import * as orchestrator from "./classification/orchestrator.js";
import * as configModule from "./config/product-config.js";

vi.mock("./classification/orchestrator.js");
vi.mock("./config/product-config.js");

describe("POST /classify", () => {
  beforeEach(() => {
    vi.mocked(configModule.loadProductConfig).mockReturnValue({
      productId: "test",
      referenceSourceId: "test-source",
      classificationPrompt: "test",
      model: "openai/gpt-4.1-mini",
      conservativeTier: "D",
      confidenceThreshold: 0.6,
    });
  });

  it("returns a classification result for a valid request", async () => {
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

    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/classify",
      payload: { documentText: "A routine memo.", productId: "test" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().class).toBe("B");
  });

  it("returns 400 for an invalid request body", async () => {
    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/classify",
      payload: { productId: "test" },
    });

    expect(response.statusCode).toBe(400);
  });
});
