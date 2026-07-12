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

  it("rejects a path-traversal productId with 400, never reaching the filesystem", async () => {
    vi.mocked(configModule.loadProductConfig).mockClear();

    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/classify",
      payload: { documentText: "hello", productId: "../../../../etc/passwd" },
    });

    expect(response.statusCode).toBe(400);
    expect(configModule.loadProductConfig).not.toHaveBeenCalled();
  });

  it("returns 404 with a generic message when loadProductConfig throws for an unknown productId", async () => {
    vi.mocked(configModule.loadProductConfig).mockClear();
    vi.mocked(configModule.loadProductConfig).mockImplementationOnce(() => {
      throw new Error(
        "Could not read product classification config at ./config/unknown.json",
      );
    });

    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/classify",
      payload: { documentText: "hello", productId: "unknown" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).not.toContain("./config");
  });

  it("returns 502 with a generic message when classify() throws, without leaking the internal error", async () => {
    vi.mocked(orchestrator.classify).mockClear();
    vi.mocked(orchestrator.classify).mockRejectedValueOnce(
      new Error("Presidio sidecar unreachable: ECONNREFUSED 127.0.0.1:5001"),
    );

    const app = buildServer();
    const response = await app.inject({
      method: "POST",
      url: "/classify",
      payload: { documentText: "hello", productId: "test" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).not.toContain("ECONNREFUSED");
  });
});
