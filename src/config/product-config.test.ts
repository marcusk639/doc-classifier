import { describe, it, expect } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProductConfig } from "./product-config.js";

function writeFixture(content: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "doc-classifier-test-"));
  const path = join(dir, "config.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}

describe("loadProductConfig", () => {
  it("loads and validates a well-formed config", () => {
    const path = writeFixture({
      productId: "veteran-claims-app",
      referenceSourceId: "va-corpus",
      classificationPrompt: "Classify by sensitivity.",
      model: "openai/gpt-4.1-mini",
      conservativeTier: "D",
      confidenceThreshold: 0.6,
    });

    const config = loadProductConfig(path);
    expect(config.productId).toBe("veteran-claims-app");
  });

  it("throws a clear error on malformed config", () => {
    const path = writeFixture({ productId: "missing-fields" });
    expect(() => loadProductConfig(path)).toThrow(
      /Invalid product classification config/,
    );
  });

  it("throws a clear error when the file doesn't exist", () => {
    expect(() => loadProductConfig("/nonexistent/config.json")).toThrow(
      /Could not read product classification config/,
    );
  });
});
