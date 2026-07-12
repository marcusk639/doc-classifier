import type { ClassificationResult } from "../types.js";
import type { ProductClassificationConfig } from "../config/product-config.js";

export function applyConfidenceGate(
  llmResult: Omit<ClassificationResult, "handlingRules" | "needsReview">,
  config: ProductClassificationConfig,
): { class: ClassificationResult["class"]; needsReview: boolean } {
  if (llmResult.confidence < config.confidenceThreshold) {
    return { class: config.conservativeTier, needsReview: true };
  }
  return { class: llmResult.class, needsReview: false };
}
