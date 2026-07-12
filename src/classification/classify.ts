import { generateObject } from "ai";
import { z } from "zod";
import { retrieveContext } from "../retrieval/rag-client.js";
import { DocumentClassSchema, type ClassificationResult } from "../types.js";
import type { ProductClassificationConfig } from "../config/product-config.js";

const LlmClassificationSchema = z.object({
  tier: DocumentClassSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

export async function classifyDocument(
  documentText: string,
  config: ProductClassificationConfig,
): Promise<Omit<ClassificationResult, "handlingRules" | "needsReview">> {
  const context = await retrieveContext(documentText.slice(0, 500), [
    config.referenceSourceId,
  ]);

  const contextBlock = context
    .map((c, i) => `[${i + 1}] (${c.sourceTitle}): ${c.text}`)
    .join("\n\n");

  const { object } = await generateObject({
    model: config.model,
    schema: LlmClassificationSchema,
    system: config.classificationPrompt,
    prompt: `Reference material:\n${contextBlock}\n\nDocument to classify:\n${documentText}`,
  });

  return {
    class: object.tier,
    confidence: object.confidence,
    rationale: object.rationale,
    retrievedContextIds: context.map((c) => c.id),
  };
}
