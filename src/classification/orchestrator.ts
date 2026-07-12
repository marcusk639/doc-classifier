import { detectPii } from "../pii/presidio-client.js";
import { classifyDocument } from "./classify.js";
import { applyConfidenceGate } from "./confidence-gate.js";
import type { ClassificationResult, HandlingRules } from "../types.js";
import type { ProductClassificationConfig } from "../config/product-config.js";

const SHARED_ACCESS_HANDLING: HandlingRules = {
  allowedAccessScope: "shared",
  requiresContentScanning: false,
  permittedForIngestion: true,
};

const RESTRICTED_ACCESS_HANDLING: HandlingRules = {
  allowedAccessScope: "single-source-only",
  requiresContentScanning: true,
  permittedForIngestion: true,
};

export async function classify(
  documentText: string,
  config: ProductClassificationConfig,
): Promise<ClassificationResult> {
  const [piiFindings, llmResult] = await Promise.all([
    detectPii(documentText),
    classifyDocument(documentText, config),
  ]);

  const gated = applyConfidenceGate(llmResult, config);

  const finalClass =
    piiFindings.length > 0 ? config.conservativeTier : gated.class;
  const handlingRules =
    finalClass === config.conservativeTier
      ? RESTRICTED_ACCESS_HANDLING
      : SHARED_ACCESS_HANDLING;

  let rationale = llmResult.rationale;
  if (gated.class !== llmResult.class) {
    rationale += ` Confidence (${llmResult.confidence.toFixed(2)}) was below the threshold (${config.confidenceThreshold}), so this was downgraded to the conservative tier for review.`;
  }
  if (piiFindings.length > 0) {
    rationale += ` Additionally, direct identifiers were detected (${piiFindings
      .map((f) => f.entityType)
      .join(", ")}), forcing the most restrictive tier.`;
  }

  return {
    class: finalClass,
    handlingRules,
    rationale,
    confidence: llmResult.confidence,
    retrievedContextIds: llmResult.retrievedContextIds,
    needsReview: gated.needsReview || piiFindings.length > 0,
  };
}
